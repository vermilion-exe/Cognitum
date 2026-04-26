package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestCompletion;
import com.cognitum.backend.dto.request.RequestMessage;
import com.cognitum.backend.dto.response.*;
import com.cognitum.backend.entity.Flashcard;
import com.cognitum.backend.entity.Note;
import com.cognitum.backend.exception.BadRequestException;
import com.cognitum.backend.exception.NotFoundException;
import com.cognitum.backend.exception.UnauthorizedException;
import com.cognitum.backend.properties.NvidiaProperties;
import com.cognitum.backend.repository.FlashcardRepository;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.service.JwtService;
import com.cognitum.backend.service.QuestionService;
import com.cognitum.backend.web.NvidiaWebClient;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QuestionServiceImpl implements QuestionService {

    private final NvidiaWebClient webClient;
    private final NvidiaProperties nvidiaProperties;
    private final NoteRepository noteRepository;
    private final FlashcardRepository flashcardRepository;
    private final JwtService jwtService;

    private ResponseCompletion requestQuestions(String markdown, Integer count) {
        RequestCompletion request = new RequestCompletion();
        request.setModel(nvidiaProperties.getModel());

        String systemPrompt = String.format("""
            You are a flashcard generation assistant for spaced repetition study.
            When given note content, generate flashcard-style questions and answers.
        
            Rules:
            - Generate %d questions depending on content length
            - Mix question types: factual, conceptual, application
            - Keep answers concise (1-3 sentences)
            - Return ONLY a raw JSON array, no markdown, no explanation
        
            Ensure that the response is in this EXACT format:
            [
              {
                "question": "...",
                "answer": "...",
                "type": "factual|conceptual|application"
              }
            ]
            """, count);

        String userPrompt = "Generate flashcards for the following note:\n\n" + markdown;

        request.setMessages(List.of(
                new RequestMessage("system", systemPrompt),
                new RequestMessage("user", userPrompt)
        ));
        request.setMaxTokens(1024);
        request.setStream(false);
        return webClient.requestCompletion(request);
    }

    @Transactional
    @Override
    public List<UUID> checkFlashcardRelevance(String markdown, List<ResponseFlashcard> flashcards) {
        if (flashcards.isEmpty()) return List.of();

        String flashcardsJson = flashcards.stream()
                .map(fc -> String.format(
                        "{\"id\": %s, \"question\": \"%s\", \"answer\": \"%s\"}",
                        fc.getId(), fc.getQuestion(), fc.getAnswer()))
                .collect(Collectors.joining(",\n", "[\n", "\n]"));

        RequestCompletion request = new RequestCompletion();
        request.setModel(nvidiaProperties.getModel());

        String systemPrompt = """
            You are a flashcard relevance checker for spaced repetition study.
            Given a note and its existing flashcards, determine which flashcards
            are no longer relevant or are now factually incorrect based on the note content.

            Rules:
            - A flashcard is irrelevant if the note no longer contains the concept it tests
            - A flashcard is irrelevant if the answer contradicts the current note content
            - Minor wording changes in the note do NOT make a flashcard irrelevant
            - Return ONLY a raw JSON array of UUIDs that are irrelevant, no markdown, no explanation
            - If all cards are relevant, return an empty array: []

            Ensure the response is in this EXACT format, with UUIDs of the flashcards in quotes:
            ["UUID1", "UUID2", "UUID3"]
            """;

        String userPrompt = """
            Note content:
            %s

            Existing flashcards:
            %s

            Return the IDs of flashcards that are no longer relevant.
            """.formatted(markdown, flashcardsJson);

        request.setMessages(List.of(
                new RequestMessage("system", systemPrompt),
                new RequestMessage("user", userPrompt)
        ));
        request.setMaxTokens(256);
        request.setStream(false);

        ResponseCompletion response = webClient.requestCompletion(request);
        if (response.getChoices() == null)
            return List.of();

        String content = response.getChoices().get(0).getMessage().getContent();

        ObjectMapper objectMapper = new ObjectMapper();
        List<UUID> staleIds = objectMapper.readValue(content, new TypeReference<List<UUID>>() {});

        if (!staleIds.isEmpty()) {
            flashcardRepository.markStaleByIds(staleIds);
        }

        return staleIds;
    }

    @Override
    public List<ResponseFlashcard> generateFlashcards(String markdown, Integer count) {
        ResponseCompletion response = requestQuestions(markdown, count);
        if (response.getChoices() == null)
            return List.of();

        String content = response.getChoices().get(0).getMessage().getContent();

        ObjectMapper objectMapper = new ObjectMapper();
        List<ResponseFlashcard> responseFlashcards = objectMapper.readValue(
                content,
                new TypeReference<List<ResponseFlashcard>>() {
                }
        );

        return responseFlashcards.stream().map(fc -> new ResponseFlashcard(
               UUID.randomUUID(),
               fc.getQuestion(),
               fc.getAnswer(),
               fc.getType(),
               false,
               false,
               2.5,
               1,
               0,
               LocalDate.now(),
               null,
               null
       )).toList();
    }

    @Override
    public ResponseOperation updateStaleFlashcards(String token, Long noteId, List<UUID> flashcardIds) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new NotFoundException("Note not found with id: " + noteId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!note.getUserId().equals(user.getId())) {
            throw new UnauthorizedException("Unauthorized access to note with id: " + noteId);
        }

        for (UUID fid : flashcardIds) {
            Flashcard flashcard = flashcardRepository.findById(fid)
                    .orElseThrow(() -> new NotFoundException("Flashcard not found with id: " + fid));
            if (!flashcard.getNote().getUserId().equals(user.getId())) {
                throw new UnauthorizedException("Unauthorized access to flashcard with id: " + fid);
            }

            flashcard.setIsStale(true);
            flashcardRepository.save(flashcard);
        }

        return new ResponseOperation(true);
    }

    @Override
    public List<ResponseFlashcard> getDueCards(String token) {
        ResponseUser user = jwtService.getTokenInfo(token);
        List<Flashcard> dueReviews = flashcardRepository.findDueCards(user.getId(), LocalDate.now());
        return dueReviews.stream().map(flashcard -> {
            return new ResponseFlashcard(
                    flashcard.getId(),
                    flashcard.getQuestion(),
                    flashcard.getAnswer(),
                    flashcard.getType(),
                    flashcard.getIsRetired(),
                    flashcard.getIsStale(),
                    flashcard.getEasinessFactor(),
                    flashcard.getInterval(),
                    flashcard.getRepetitions(),
                    flashcard.getNextReview(),
                    flashcard.getLastReviewed(),
                    flashcard.getNote().getId()
            );
        }).toList();
    }

    @Override
    public ResponseOperation createFlashcards(String token, List<ResponseFlashcard> request) {
        request.forEach(fc -> {
            ResponseUser user = jwtService.getTokenInfo(token);
            Flashcard oldFlashcard = flashcardRepository.findById(fc.getId())
                    .orElse(null);
            if (oldFlashcard != null && !oldFlashcard.getNote().getUserId().equals(user.getId())) {
                throw new UnauthorizedException("Unauthorized access to flashcard with id: " + fc.getId());
            }

            Flashcard flashcard = getFlashcard(user, fc);

            flashcardRepository.save(flashcard);
        });

        return new ResponseOperation(true);
    }

    private Flashcard getFlashcard(ResponseUser user, ResponseFlashcard request) {
        Flashcard flashcard = new Flashcard();
        flashcard.setId(request.getId());
        Note note = noteRepository.findById(request.getNoteId())
                        .orElseThrow(() -> new NotFoundException("Note not found"));
        if(!note.getUserId().equals(user.getId())) {
            throw new UnauthorizedException("Unauthorized access to flashcard with id: " + request.getId());
        }
        flashcard.setNote(note);
        flashcard.setQuestion(request.getQuestion());
        flashcard.setAnswer(request.getAnswer());
        flashcard.setType(request.getType());
        flashcard.setIsRetired(request.getIsRetired());
        flashcard.setIsStale(request.getIsStale());
        flashcard.setEasinessFactor(request.getEasinessFactor());
        flashcard.setIsRetired(request.getIsRetired());
        flashcard.setInterval(request.getInterval());
        flashcard.setRepetitions(request.getRepetitions());
        flashcard.setNextReview(request.getNextReview());
        flashcard.setLastReviewed(request.getLastReviewed());
        return flashcard;
    }

    @Override
    public ResponseOperation submitReview(String token, ResponseFlashcard review) {
        ResponseUser user = jwtService.getTokenInfo(token);
        Flashcard flashcard = flashcardRepository.findById(review.getId())
                .orElseThrow(() -> new NotFoundException("Flashcard not found with id: " + review.getId()));
        if (!flashcard.getNote().getUserId().equals(user.getId())) {
            throw new UnauthorizedException("Unauthorized access to flashcard with id: " + review.getId());
        }

        flashcard.setEasinessFactor(review.getEasinessFactor());
        flashcard.setIsRetired(review.getIsRetired());
        flashcard.setInterval(review.getInterval());
        flashcard.setRepetitions(review.getRepetitions());
        flashcard.setNextReview(review.getNextReview());
        flashcard.setLastReviewed(OffsetDateTime.now());

        flashcardRepository.save(flashcard);

        return new ResponseOperation(true);
    }

    @Override
    public List<ResponseFlashcard> getFlashcardsByNoteId(String token, Long noteId) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new NotFoundException("Note not found with id: " + noteId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!note.getUserId().equals(user.getId())) {
            throw new UnauthorizedException("Unauthorized access to note with id: " + noteId);
        }
        List<Flashcard> flashcards = flashcardRepository.findAllByNoteId(noteId);
        return flashcards.stream().map(fc -> new ResponseFlashcard(
                fc.getId(),
                fc.getQuestion(),
                fc.getAnswer(),
                fc.getType(),
                fc.getIsRetired(),
                fc.getIsStale(),
                fc.getEasinessFactor(),
                fc.getInterval(),
                fc.getRepetitions(),
                fc.getNextReview(),
                fc.getLastReviewed(),
                noteId
        )).toList();
    }

    @Transactional
    @Override
    public ResponseOperation deleteStaleFlashcards(String token, Long noteId) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new NotFoundException("Note not found with id: " + noteId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!note.getUserId().equals(user.getId())) {
            throw new UnauthorizedException("Unauthorized access to note with id: " + noteId);
        }
        List<Flashcard> staleFlashcards = flashcardRepository.findAllByNoteId(noteId).stream()
                .filter(Flashcard::getIsStale)
                .toList();
        flashcardRepository.deleteAll(staleFlashcards);

        return new ResponseOperation(true);
    }

    @Transactional
    @Override
    public ResponseOperation deleteAllFlashcardsByNoteId(String token, Long noteId) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new NotFoundException("Note not found with id: " + noteId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!note.getUserId().equals(user.getId())) {
            throw new UnauthorizedException("Unauthorized access to note with id: " + noteId);
        }
        flashcardRepository.deleteAllByNoteId(noteId);

        return new ResponseOperation(true);
    }

    @Transactional
    @Override
    public ResponseOperation deleteFlashcardsExcept(String token, List<UUID> flashcardIds) {
        List<Flashcard> flashcards = flashcardRepository.findAllById(flashcardIds);

        if (flashcards.size() != flashcardIds.size()) {
            throw new NotFoundException("One or more flashcards not found for the provided IDs");
        }

        List<Long> noteIds = flashcards.stream()
                .map(fc -> fc.getNote().getId())
                .distinct()
                .toList();

        if (noteIds.size() != 1) {
            throw new BadRequestException("Provided flashcards do not belong to the same note");
        }

        ResponseUser user = jwtService.getTokenInfo(token);
        Note note = flashcards.get(0).getNote();
        if (!note.getUserId().equals(user.getId())) {
            throw new UnauthorizedException("Unauthorized access to flashcards of note with id: " + note.getId());
        }

        flashcardRepository.deleteAllExcept(flashcardIds);

        return new ResponseOperation(true);
    }

    @Transactional
    @Override
    public ResponseOperation deleteFlashcard(String token, UUID flashcardId) {
        Flashcard flashcard = flashcardRepository.findById(flashcardId)
                .orElseThrow(() -> new NotFoundException("Flashcard not found with id: " + flashcardId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!flashcard.getNote().getUserId().equals(user.getId())) {
            throw new UnauthorizedException("Unauthorized access to flashcard with id: " + flashcardId);
        }
        flashcardRepository.delete(flashcard);

        return new ResponseOperation(true);
    }

}
