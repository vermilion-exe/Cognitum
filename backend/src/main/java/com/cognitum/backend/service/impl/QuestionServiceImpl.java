package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestCompletion;
import com.cognitum.backend.dto.request.RequestMessage;
import com.cognitum.backend.dto.response.*;
import com.cognitum.backend.entity.Flashcard;
import com.cognitum.backend.entity.Note;
import com.cognitum.backend.exception.BadRequestException;
import com.cognitum.backend.exception.NotFoundException;
import com.cognitum.backend.exception.UnauthorizedException;
import com.cognitum.backend.properties.ApplicationProperties;
import com.cognitum.backend.properties.NvidiaProperties;
import com.cognitum.backend.repository.FlashcardRepository;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.service.JwtService;
import com.cognitum.backend.service.NoteService;
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
    private final NoteService noteService;
    private final FlashcardRepository flashcardRepository;
    private final JwtService jwtService;
    private final ApplicationProperties applicationProperties;

    private ResponseCompletion requestQuestions(String markdown, Integer count) {
        if (isTestMode()) {
            return completion(templateFlashcardsFor(markdown));
        }

        // Ask the AI model to return flashcards as raw JSON
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
        if (isTestMode()) {
            String noteTopic = testTopicFor(markdown);
            List<UUID> ids = flashcards.stream()
                    .filter(flashcard -> !noteTopic.equals(testTopicFor(flashcard.getQuestion() + " " + flashcard.getAnswer())))
                    .map(ResponseFlashcard::getId)
                    .toList();
            System.out.println(ids);
            return ids;
        }

        // Send the existing cards so the model can identify stale ones
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

        // Parse the model's JSON array of stale flashcard ids
        String content = response.getChoices().get(0).getMessage().getContent();

        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(content, new TypeReference<List<UUID>>() {});
    }

    private ResponseCompletion completion(String content) {
        return new ResponseCompletion(List.of(new ResponseChoice(new RequestMessage("assistant", content))));
    }

    private String templateFlashcardsFor(String markdown) {
        return switch (testTopicFor(markdown)) {
            case "array-list" -> """
                    [
                      {"question":"How does an array list store elements?","answer":"It stores elements inside an internal array with spare capacity for additions.","type":"factual"},
                      {"question":"Why keep free space in the internal array?","answer":"Free space lets the list add elements without allocating a new array every time.","type":"conceptual"},
                      {"question":"When should an array list resize?","answer":"It should resize when the element count reaches the internal array length.","type":"application"},
                      {"question":"What does the count track in an array list?","answer":"The count tracks how many positions in the internal array currently contain list elements.","type":"factual"},
                      {"question":"How are reads and writes performed in this implementation?","answer":"They are performed directly against the internal array.","type":"application"}
                    ]
                    """;
            case "crypto" -> """
                    [
                      {"question":"What is the role of the one-time key k?","answer":"It is a randomly generated value used for one ciphertext at a time.","type":"factual"},
                      {"question":"Why does changing k matter for encryption?","answer":"A different k changes each ciphertext even when related plaintexts are encrypted.","type":"conceptual"},
                      {"question":"What private value does the receiver know?","answer":"The receiver knows the matching private key x.","type":"factual"},
                      {"question":"Why can the receiver not simply reverse the public-key process?","answer":"The ciphertext also depends on the one-time key k, which the receiver does not know.","type":"conceptual"},
                      {"question":"What property is supported by the unknown one-time key?","answer":"It helps ensure non-repudiation in the described process.","type":"application"}
                    ]
                    """;
            default -> """
                    [
                      {"question":"What is SOLID?","answer":"A set of object-oriented design principles.","type":"factual"},
                      {"question":"What does SRP encourage?","answer":"A class should have one reason to change.","type":"conceptual"},
                      {"question":"How does OCP guide extension?","answer":"Software should be open for extension and closed for modification.","type":"application"},
                      {"question":"Why use LSP?","answer":"Subtypes should be substitutable for their base types.","type":"conceptual"},
                      {"question":"What does DIP prefer?","answer":"Depend on abstractions rather than concrete implementations.","type":"factual"}
                    ]
                    """;
        };
    }

    private String testTopicFor(String text) {
        String normalized = text == null ? "" : text.toLowerCase();
        if (normalized.contains("array list")
                || normalized.contains("internal array")
                || normalized.contains("resize")) {
            return "array-list";
        }
        if (normalized.contains("ciphertext")
                || normalized.contains("private key")
                || normalized.contains("one-time key")
                || normalized.contains("non-repudiation")) {
            return "crypto";
        }
        return "default";
    }

    private boolean isTestMode() {
        return applicationProperties != null && Boolean.TRUE.equals(applicationProperties.getIsTestMode());
    }

    @Override
    public List<ResponseFlashcard> generateFlashcards(String markdown, Integer count) {
        // Generate new cards, then initialize review metadata locally
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
        // Only the note owner can mark its flashcards stale
        if (!note.getUserId().equals(user.getId())) {
            throw new UnauthorizedException("Unauthorized access to note with id: " + noteId);
        }

        for (UUID fid : flashcardIds) {
            // Each flashcard is checked before it is marked stale
            Flashcard flashcard = flashcardRepository.findById(fid)
                    .orElseThrow(() -> new NotFoundException("Flashcard not found with id: " + fid));
            if (!flashcard.getNote().getUserId().equals(user.getId())) {
                throw new UnauthorizedException("Unauthorized access to flashcard with id: " + fid);
            }

            flashcard.setIsStale(true);
            flashcardRepository.save(flashcard);
        }

        noteService.updateNoteTimestamp(note);

        return new ResponseOperation(true);
    }

    @Override
    public List<ResponseFlashcard> getDueCards(String token) {
        // Fetch cards due for review today or earlier
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
            // Existing cards must still belong to the current user
            Flashcard oldFlashcard = flashcardRepository.findById(fc.getId())
                    .orElse(null);
            if (oldFlashcard != null && !oldFlashcard.getNote().getUserId().equals(user.getId())) {
                throw new UnauthorizedException("Unauthorized access to flashcard with id: " + fc.getId());
            }

            Flashcard flashcard = getFlashcard(user, fc);

            Note note = flashcard.getNote();

            flashcardRepository.save(flashcard);

            noteService.updateNoteTimestamp(note);
        });

        return new ResponseOperation(true);
    }

    private Flashcard getFlashcard(ResponseUser user, ResponseFlashcard request) {
        // Convert the API shape into a Flashcard entity
        Flashcard flashcard = new Flashcard();
        flashcard.setId(request.getId());
        if (request.getNoteId() == null) {
            throw new BadRequestException("Note ID is required for flashcard creation");
        }
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
        // Save the spaced-repetition result for a reviewed card
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

        Note note = flashcard.getNote();

        flashcardRepository.save(flashcard);

        noteService.updateNoteTimestamp(note);

        return new ResponseOperation(true);
    }

    @Override
    public List<ResponseFlashcard> getFlashcardsByNoteId(String token, Long noteId) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new NotFoundException("Note not found with id: " + noteId));
        ResponseUser user = jwtService.getTokenInfo(token);
        // Card lists are scoped through note ownership
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
        // Remove only cards already marked stale for this note
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

        noteService.updateNoteTimestamp(note);

        return new ResponseOperation(true);
    }

    @Transactional
    @Override
    public ResponseOperation deleteAllFlashcardsByNoteId(String token, Long noteId) {
        // Clear all flashcards for one owned note
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new NotFoundException("Note not found with id: " + noteId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!note.getUserId().equals(user.getId())) {
            throw new UnauthorizedException("Unauthorized access to note with id: " + noteId);
        }
        flashcardRepository.deleteAllByNoteId(noteId);

        noteService.updateNoteTimestamp(note);

        return new ResponseOperation(true);
    }

    @Transactional
    @Override
    public ResponseOperation deleteFlashcardsExcept(String token, List<UUID> flashcardIds) {
        // Used by sync to keep only the flashcards still present locally
        List<Flashcard> flashcards = flashcardRepository.findAllById(flashcardIds);

        if (flashcards.size() != flashcardIds.size()) {
            throw new NotFoundException("One or more flashcards not found for the provided IDs");
        }

        List<Long> noteIds = flashcards.stream()
                .map(fc -> fc.getNote().getId())
                .distinct()
                .toList();

        // Keep this bulk delete scoped to one note
        if (noteIds.size() != 1) {
            throw new BadRequestException("Provided flashcards do not belong to the same note");
        }

        ResponseUser user = jwtService.getTokenInfo(token);
        Note note = flashcards.get(0).getNote();
        if (!note.getUserId().equals(user.getId())) {
            throw new UnauthorizedException("Unauthorized access to flashcards of note with id: " + note.getId());
        }

        flashcardRepository.deleteAllExcept(flashcardIds);

        noteService.updateNoteTimestamp(note);

        return new ResponseOperation(true);
    }

    @Transactional
    @Override
    public ResponseOperation deleteFlashcard(String token, UUID flashcardId) {
        // Delete one owned flashcard and update its parent note timestamp
        Flashcard flashcard = flashcardRepository.findById(flashcardId)
                .orElseThrow(() -> new NotFoundException("Flashcard not found with id: " + flashcardId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!flashcard.getNote().getUserId().equals(user.getId())) {
            throw new UnauthorizedException("Unauthorized access to flashcard with id: " + flashcardId);
        }
        Note note = flashcard.getNote();

        flashcardRepository.delete(flashcard);

        noteService.updateNoteTimestamp(note);

        return new ResponseOperation(true);
    }

}
