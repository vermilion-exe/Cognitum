package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestCompletion;
import com.cognitum.backend.dto.request.RequestMessage;
import com.cognitum.backend.dto.response.*;
import com.cognitum.backend.entity.Flashcard;
import com.cognitum.backend.entity.Note;
import com.cognitum.backend.properties.NvidiaProperties;
import com.cognitum.backend.repository.FlashcardRepository;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.service.JwtService;
import com.cognitum.backend.service.QuestionService;
import com.cognitum.backend.service.SM2Service;
import com.cognitum.backend.web.NvidiaWebClient;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QuestionServiceImpl implements QuestionService {

    private final NvidiaWebClient webClient;
    private final NvidiaProperties nvidiaProperties;
    private final NoteRepository noteRepository;
    private final FlashcardRepository flashcardRepository;
    private final JwtService jwtService;
    private final SM2Service sm2Service;

    private ResponseCompletion requestQuestions(Long noteId, Integer count) {
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
        
            Format:
            [
              {
                "question": "...",
                "answer": "...",
                "type": "factual|conceptual|application"
              }
            ]
            """, count);

        String userPrompt = "Generate flashcards for the following note:\n\n" + noteRepository.findById(noteId)
                .orElseThrow(() -> new RuntimeException("Note not found with id: " + noteId))
                .getText();

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
    public List<Long> checkFlashcardRelevance(String token, Long noteId) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new RuntimeException("Note not found with id: " + noteId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!note.getUserId().equals(user.getId())) {
            throw new RuntimeException("Unauthorized access to note with id: " + noteId);
        }

        List<Flashcard> flashcards = flashcardRepository.findAllByNoteIdAndIsRetiredFalse(noteId);
        if (flashcards.isEmpty()) return List.of();

        String flashcardsJson = flashcards.stream()
                .map(fc -> String.format(
                        "{\"id\": %d, \"question\": \"%s\", \"answer\": \"%s\"}",
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
            - Return ONLY a raw JSON array of IDs that are irrelevant, no markdown, no explanation
            - If all cards are relevant, return an empty array: []

            Format:
            [1, 4, 7]
            """;

        String userPrompt = """
            Note content:
            %s

            Existing flashcards:
            %s

            Return the IDs of flashcards that are no longer relevant.
            """.formatted(note.getText(), flashcardsJson);

        request.setMessages(List.of(
                new RequestMessage("system", systemPrompt),
                new RequestMessage("user", userPrompt)
        ));
        request.setMaxTokens(256);
        request.setStream(false);

        ResponseCompletion response = webClient.requestCompletion(request);
        String content = response.getChoices().get(0).getMessage().getContent();

        ObjectMapper objectMapper = new ObjectMapper();
        List<Long> staleIds = objectMapper.readValue(content, new TypeReference<List<Long>>() {});

        if (!staleIds.isEmpty()) {
            flashcardRepository.markStaleByIds(staleIds);
        }

        return staleIds;
    }

    @Override
    public List<ResponseFlashcard> generateFlashcards(String token, Long noteId, Integer count) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new RuntimeException("Note not found with id: " + noteId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!note.getUserId().equals(user.getId())) {
            throw new RuntimeException("Unauthorized access to note with id: " + noteId);
        }

//        flashcardRepository.deleteAllByNoteId(noteId);

        ResponseCompletion response = requestQuestions(noteId, count);
        String content = response.getChoices().get(0).getMessage().getContent();

        ObjectMapper objectMapper = new ObjectMapper();
        List<ResponseFlashcard> responseFlashcards = objectMapper.readValue(
                content,
                new TypeReference<List<ResponseFlashcard>>() {
                }
        );

        return responseFlashcards.stream().map(fc -> {
            Flashcard flashcard = new Flashcard();
            flashcard.setQuestion(fc.getQuestion());
            flashcard.setAnswer(fc.getAnswer());
            flashcard.setType(fc.getType());
            flashcard.setNote(note);
            Flashcard savedFlashcard = flashcardRepository.save(flashcard);

            return new ResponseFlashcard(savedFlashcard.getId(),
                    savedFlashcard.getQuestion(),
                    savedFlashcard.getAnswer(),
                    savedFlashcard.getType(),
                    savedFlashcard.getIsRetired(),
                    savedFlashcard.getIsStale(),
                    savedFlashcard.getEasinessFactor(),
                    savedFlashcard.getInterval(),
                    savedFlashcard.getRepetitions(),
                    savedFlashcard.getNextReview(),
                    savedFlashcard.getLastReviewed(),
                    noteId
            );
        }).toList();
    }

    @Override
    public ResponseOperation updateStaleFlashcards(String token, Long noteId, List<Long> flashcardIds) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new RuntimeException("Note not found with id: " + noteId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!note.getUserId().equals(user.getId())) {
            throw new RuntimeException("Unauthorized access to note with id: " + noteId);
        }

        for (Long fid : flashcardIds) {
            Flashcard flashcard = flashcardRepository.findById(fid)
                    .orElseThrow(() -> new RuntimeException("Flashcard not found with id: " + fid));
            if (!flashcard.getNote().getUserId().equals(user.getId())) {
                throw new RuntimeException("Unauthorized access to flashcard with id: " + fid);
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
    public ResponseOperation submitReview(String token, ResponseFlashcard review) {
        ResponseUser user = jwtService.getTokenInfo(token);
        Flashcard flashcard = flashcardRepository.findById(review.getId())
                .orElseThrow(() -> new RuntimeException("Flashcard not found with id: " + review.getId()));
        if (!flashcard.getNote().getUserId().equals(user.getId())) {
            throw new RuntimeException("Unauthorized access to flashcard with id: " + review.getId());
        }

        flashcard.setEasinessFactor(review.getEasinessFactor());
        flashcard.setIsRetired(review.getIsRetired());
        flashcard.setInterval(review.getInterval());
        flashcard.setRepetitions(review.getRepetitions());
        flashcard.setNextReview(review.getNextReview());
        flashcard.setLastReviewed(LocalDateTime.now());

        flashcardRepository.save(flashcard);

        return new ResponseOperation(true);
    }

    @Override
    public List<ResponseFlashcard> getFlashcardsByNoteId(String token, Long noteId) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new RuntimeException("Note not found with id: " + noteId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!note.getUserId().equals(user.getId())) {
            throw new RuntimeException("Unauthorized access to note with id: " + noteId);
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

    @Override
    public ResponseOperation deleteStaleFlashcards(String token, Long noteId) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new RuntimeException("Note not found with id: " + noteId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!note.getUserId().equals(user.getId())) {
            throw new RuntimeException("Unauthorized access to note with id: " + noteId);
        }
        List<Flashcard> staleFlashcards = flashcardRepository.findAllByNoteId(noteId).stream()
                .filter(Flashcard::getIsStale)
                .toList();
        flashcardRepository.deleteAll(staleFlashcards);

        return new ResponseOperation(true);
    }

    @Override
    public ResponseOperation deleteAllFlashcardsByNoteId(String token, Long noteId) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new RuntimeException("Note not found with id: " + noteId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!note.getUserId().equals(user.getId())) {
            throw new RuntimeException("Unauthorized access to note with id: " + noteId);
        }
        flashcardRepository.deleteAllByNoteId(noteId);

        return new ResponseOperation(true);
    }

    @Override
    public ResponseOperation deleteFlashcard(String token, Long flashcardId) {
        Flashcard flashcard = flashcardRepository.findById(flashcardId)
                .orElseThrow(() -> new RuntimeException("Flashcard not found with id: " + flashcardId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!flashcard.getNote().getUserId().equals(user.getId())) {
            throw new RuntimeException("Unauthorized access to flashcard with id: " + flashcardId);
        }
        flashcardRepository.delete(flashcard);

        return new ResponseOperation(true);
    }

}
