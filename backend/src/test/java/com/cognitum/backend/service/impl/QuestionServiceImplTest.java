package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.response.ResponseCompletion;
import com.cognitum.backend.dto.response.ResponseFlashcard;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.entity.Flashcard;
import com.cognitum.backend.entity.Note;
import com.cognitum.backend.enums.FlashcardType;
import com.cognitum.backend.properties.NvidiaProperties;
import com.cognitum.backend.repository.FlashcardRepository;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.service.JwtService;
import com.cognitum.backend.web.NvidiaWebClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuestionServiceImplTest {

    @Mock
    private NvidiaWebClient webClient;

    @Mock
    private NvidiaProperties nvidiaProperties;

    @Mock
    private NoteRepository noteRepository;

    @Mock
    private FlashcardRepository flashcardRepository;

    @Mock
    private JwtService jwtService;

    @InjectMocks
    private QuestionServiceImpl questionService;

    private ResponseUser mockUser;
    private String mockToken;
    private Note mockNote;

    @BeforeEach
    void setUp() {
        mockToken = "Bearer mockToken";
        mockUser = ResponseUser.builder()
                .email("test@example.com")
                .username("testuser")
                .id(UUID.randomUUID())
                .build();

        mockNote = new Note();
        mockNote.setId(1L);
        mockNote.setText("Test note content for flashcard generation");
        mockNote.setUserId(mockUser.getId());
        mockNote.setPath("/test/path");
        mockNote.setCreatedAt(LocalDateTime.now());
        mockNote.setLastUpdated(LocalDateTime.now());
    }

    @Test
    void generateFlashcards_whenNoteExists_generatesFlashcards() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));
        when(nvidiaProperties.getModel()).thenReturn("test-model");

        String jsonResponse = """
            [
                {"question": "What is Java?", "answer": "A programming language", "type": "factual"},
                {"question": "Explain OOP", "answer": "Object-oriented programming", "type": "conceptual"}
            ]
            """;

        ResponseCompletion mockResponse = new ResponseCompletion(null);
        when(webClient.requestCompletion(any())).thenReturn(mockResponse);

        List<ResponseFlashcard> result = questionService.generateFlashcards(mockToken, 1L, 5);

        assertNotNull(result);
        verify(webClient).requestCompletion(any());
    }

    @Test
    void generateFlashcards_savesFlashcardsToRepository() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));
        when(nvidiaProperties.getModel()).thenReturn("test-model");

        String jsonResponse = """
            [{"question": "Q1", "answer": "A1", "type": "factual"}]
            """;

        when(webClient.requestCompletion(any())).thenAnswer(invocation -> {
            Flashcard flashcard = new Flashcard();
            flashcard.setId(1L);
            flashcard.setQuestion("Q1");
            flashcard.setAnswer("A1");
            flashcard.setType(FlashcardType.FACTUAL);
            flashcard.setNote(mockNote);
            flashcard.setIsRetired(false);
            flashcard.setIsStale(false);
            flashcard.setEasinessFactor(2.5);
            flashcard.setInterval(1);
            flashcard.setRepetitions(0);
            flashcard.setNextReview(LocalDate.now());
            when(flashcardRepository.save(any(Flashcard.class))).thenReturn(flashcard);
            return new ResponseCompletion(null);
        });

        questionService.generateFlashcards(mockToken, 1L, 5);

        verify(flashcardRepository).save(any(Flashcard.class));
    }

    @Test
    void generateFlashcards_whenNoteNotFound_throwsException() {
        when(noteRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> questionService.generateFlashcards(mockToken, 999L, 5));
    }

    @Test
    void generateFlashcards_whenUnauthorized_throwsException() {
        UUID otherUserId = UUID.randomUUID();
        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(otherUserId);

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(otherNote));

        assertThrows(RuntimeException.class, () -> questionService.generateFlashcards(mockToken, 1L, 5));
    }

    @Test
    void checkFlashcardRelevance_whenNoFlashcards_returnsEmptyList() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));
        when(flashcardRepository.findAllByNoteIdAndIsRetiredFalse(1L)).thenReturn(List.of());

        List<Long> result = questionService.checkFlashcardRelevance(mockToken, 1L);

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void checkFlashcardRelevance_marksStaleFlashcards() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));

        Flashcard flashcard1 = new Flashcard();
        flashcard1.setId(1L);
        flashcard1.setQuestion("Q1");
        flashcard1.setAnswer("A1");
        flashcard1.setNote(mockNote);

        when(flashcardRepository.findAllByNoteIdAndIsRetiredFalse(1L)).thenReturn(List.of(flashcard1));

        String jsonResponse = """
            [1]
            """;

        ResponseCompletion mockResponse = new ResponseCompletion(null);
        when(webClient.requestCompletion(any())).thenReturn(mockResponse);

        questionService.checkFlashcardRelevance(mockToken, 1L);

        verify(flashcardRepository).markStaleByIds(anyList());
    }

    @Test
    void updateStaleFlashcards_updatesFlashcards() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));

        Flashcard flashcard = new Flashcard();
        flashcard.setId(1L);
        flashcard.setQuestion("Q1");
        flashcard.setAnswer("A1");
        flashcard.setNote(mockNote);
        flashcard.setIsStale(false);

        when(flashcardRepository.findById(1L)).thenReturn(Optional.of(flashcard));
        when(flashcardRepository.save(any(Flashcard.class))).thenReturn(flashcard);

        List<Long> flashcardIds = List.of(1L);
        ResponseOperation result = questionService.updateStaleFlashcards(mockToken, 1L, flashcardIds);

        assertTrue(result.getSuccess());
        assertTrue(flashcard.getIsStale());
    }

    @Test
    void updateStaleFlashcards_whenFlashcardNotFound_throwsException() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));
        when(flashcardRepository.findById(999L)).thenReturn(Optional.empty());

        List<Long> flashcardIds = List.of(999L);

        assertThrows(RuntimeException.class, () -> questionService.updateStaleFlashcards(mockToken, 1L, flashcardIds));
    }

    @Test
    void updateStaleFlashcards_whenUnauthorized_throwsException() {
        UUID otherUserId = UUID.randomUUID();
        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(otherUserId);

        Flashcard flashcard = new Flashcard();
        flashcard.setId(1L);
        flashcard.setNote(otherNote);

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(otherNote));
        when(flashcardRepository.findById(1L)).thenReturn(Optional.of(flashcard));

        List<Long> flashcardIds = List.of(1L);

        assertThrows(RuntimeException.class, () -> questionService.updateStaleFlashcards(mockToken, 1L, flashcardIds));
    }

    @Test
    void getDueCards_returnsDueFlashcards() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);

        Flashcard flashcard = new Flashcard();
        flashcard.setId(1L);
        flashcard.setQuestion("Q1");
        flashcard.setAnswer("A1");
        flashcard.setType(FlashcardType.FACTUAL);
        flashcard.setIsRetired(false);
        flashcard.setIsStale(false);
        flashcard.setEasinessFactor(2.5);
        flashcard.setInterval(1);
        flashcard.setRepetitions(0);
        flashcard.setNextReview(LocalDate.now());
        flashcard.setLastReviewed(LocalDateTime.now());
        flashcard.setNote(mockNote);

        when(flashcardRepository.findDueCards(mockUser.getId(), LocalDate.now())).thenReturn(List.of(flashcard));

        List<ResponseFlashcard> result = questionService.getDueCards(mockToken);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("Q1", result.get(0).getQuestion());
    }

    @Test
    void getDueCards_whenNoDueCards_returnsEmptyList() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(flashcardRepository.findDueCards(any(), any())).thenReturn(List.of());

        List<ResponseFlashcard> result = questionService.getDueCards(mockToken);

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void submitReview_updatesFlashcard() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);

        Flashcard flashcard = new Flashcard();
        flashcard.setId(1L);
        flashcard.setQuestion("Q1");
        flashcard.setAnswer("A1");
        flashcard.setNote(mockNote);
        flashcard.setEasinessFactor(2.5);
        flashcard.setInterval(1);
        flashcard.setRepetitions(0);
        flashcard.setNextReview(LocalDate.now());

        when(flashcardRepository.findById(1L)).thenReturn(Optional.of(flashcard));
        when(flashcardRepository.save(any(Flashcard.class))).thenReturn(flashcard);

        ResponseFlashcard responseFlashcard = new ResponseFlashcard();
        responseFlashcard.setId(1L);
        responseFlashcard.setEasinessFactor(3.0);
        responseFlashcard.setInterval(2);
        responseFlashcard.setRepetitions(1);
        responseFlashcard.setNextReview(LocalDate.now().plusDays(1));
        responseFlashcard.setIsRetired(false);

        ResponseOperation result = questionService.submitReview(mockToken, responseFlashcard);

        assertTrue(result.getSuccess());
        assertEquals(3.0, flashcard.getEasinessFactor());
        assertEquals(2, flashcard.getInterval());
        assertEquals(1, flashcard.getRepetitions());
        assertNotNull(flashcard.getLastReviewed());
    }

    @Test
    void submitReview_whenFlashcardNotFound_throwsException() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(flashcardRepository.findById(999L)).thenReturn(Optional.empty());

        ResponseFlashcard responseFlashcard = new ResponseFlashcard();
        responseFlashcard.setId(999L);

        assertThrows(RuntimeException.class, () -> questionService.submitReview(mockToken, responseFlashcard));
    }

    @Test
    void getFlashcardsByNoteId_returnsFlashcards() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));

        Flashcard flashcard = new Flashcard();
        flashcard.setId(1L);
        flashcard.setQuestion("Q1");
        flashcard.setAnswer("A1");
        flashcard.setType(FlashcardType.FACTUAL);
        flashcard.setIsRetired(false);
        flashcard.setIsStale(false);
        flashcard.setEasinessFactor(2.5);
        flashcard.setInterval(1);
        flashcard.setRepetitions(0);
        flashcard.setNextReview(LocalDate.now());
        flashcard.setNote(mockNote);

        when(flashcardRepository.findAllByNoteId(1L)).thenReturn(List.of(flashcard));

        List<ResponseFlashcard> result = questionService.getFlashcardsByNoteId(mockToken, 1L);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("Q1", result.get(0).getQuestion());
    }

    @Test
    void getFlashcardsByNoteId_whenUnauthorized_throwsException() {
        UUID otherUserId = UUID.randomUUID();
        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(otherUserId);

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(otherNote));

        assertThrows(RuntimeException.class, () -> questionService.getFlashcardsByNoteId(mockToken, 1L));
    }

    @Test
    void deleteStaleFlashcards_deletesStaleFlashcards() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));

        Flashcard staleFlashcard = new Flashcard();
        staleFlashcard.setId(1L);
        staleFlashcard.setIsStale(true);
        staleFlashcard.setNote(mockNote);

        Flashcard nonStaleFlashcard = new Flashcard();
        nonStaleFlashcard.setId(2L);
        nonStaleFlashcard.setIsStale(false);
        nonStaleFlashcard.setNote(mockNote);

        when(flashcardRepository.findAllByNoteId(1L)).thenReturn(List.of(staleFlashcard, nonStaleFlashcard));

        ResponseOperation result = questionService.deleteStaleFlashcards(mockToken, 1L);

        assertTrue(result.getSuccess());
        verify(flashcardRepository).delete(staleFlashcard);
    }

    @Test
    void deleteAllFlashcardsByNoteId_deletesAllFlashcards() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));

        ResponseOperation result = questionService.deleteAllFlashcardsByNoteId(mockToken, 1L);

        assertTrue(result.getSuccess());
        verify(flashcardRepository).deleteAllByNoteId(1L);
    }

    @Test
    void deleteAllFlashcardsByNoteId_whenUnauthorized_throwsException() {
        UUID otherUserId = UUID.randomUUID();
        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(otherUserId);

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(otherNote));

        assertThrows(RuntimeException.class, () -> questionService.deleteAllFlashcardsByNoteId(mockToken, 1L));
    }

    @Test
    void deleteFlashcard_deletesFlashcard() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);

        Flashcard flashcard = new Flashcard();
        flashcard.setId(1L);
        flashcard.setNote(mockNote);

        when(flashcardRepository.findById(1L)).thenReturn(Optional.of(flashcard));

        ResponseOperation result = questionService.deleteFlashcard(mockToken, 1L);

        assertTrue(result.getSuccess());
        verify(flashcardRepository).delete(flashcard);
    }

    @Test
    void deleteFlashcard_whenNotFound_throwsException() {
        when(flashcardRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> questionService.deleteFlashcard(mockToken, 999L));
    }

    @Test
    void deleteFlashcard_whenUnauthorized_throwsException() {
        UUID otherUserId = UUID.randomUUID();
        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(otherUserId);

        Flashcard flashcard = new Flashcard();
        flashcard.setId(1L);
        flashcard.setNote(otherNote);

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(flashcardRepository.findById(1L)).thenReturn(Optional.of(flashcard));

        assertThrows(RuntimeException.class, () -> questionService.deleteFlashcard(mockToken, 1L));
    }
}
