package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestMessage;
import com.cognitum.backend.dto.response.ResponseChoice;
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
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
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
        mockNote.setCreatedAt(OffsetDateTime.now());
        mockNote.setLastUpdated(OffsetDateTime.now());
    }

    @Test
    void generateFlashcards_whenCompletionHasChoices_generatesFlashcardsWithDefaults() {
        when(nvidiaProperties.getModel()).thenReturn("test-model");
        when(webClient.requestCompletion(any())).thenReturn(completion("""
                [
                    {"question": "What is Java?", "answer": "A programming language", "type": "FACTUAL"},
                    {"question": "Explain OOP", "answer": "Object-oriented programming", "type": "CONCEPTUAL"}
                ]
                """));

        List<ResponseFlashcard> result = questionService.generateFlashcards("Test note content", 5);

        assertEquals(2, result.size());
        assertNotNull(result.get(0).getId());
        assertEquals("What is Java?", result.get(0).getQuestion());
        assertEquals(FlashcardType.FACTUAL, result.get(0).getType());
        assertFalse(result.get(0).getIsRetired());
        assertFalse(result.get(0).getIsStale());
        assertEquals(2.5, result.get(0).getEasinessFactor());
        assertEquals(1, result.get(0).getInterval());
        assertEquals(0, result.get(0).getRepetitions());
        assertEquals(LocalDate.now(), result.get(0).getNextReview());
        verify(webClient).requestCompletion(any());
    }

    @Test
    void generateFlashcards_whenCompletionHasNoChoices_returnsEmptyList() {
        when(nvidiaProperties.getModel()).thenReturn("test-model");
        when(webClient.requestCompletion(any())).thenReturn(new ResponseCompletion(null));

        List<ResponseFlashcard> result = questionService.generateFlashcards("Test note content", 5);

        assertTrue(result.isEmpty());
    }

    @Test
    void createFlashcards_savesFlashcardsToRepository() {
        UUID flashcardId = UUID.randomUUID();
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);
        when(flashcardRepository.findById(flashcardId)).thenReturn(Optional.empty());
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));

        ResponseFlashcard request = createResponseFlashcard(flashcardId);

        ResponseOperation result = questionService.createFlashcards(mockToken, List.of(request));

        assertTrue(result.getSuccess());
        ArgumentCaptor<Flashcard> captor = ArgumentCaptor.forClass(Flashcard.class);
        verify(flashcardRepository).save(captor.capture());
        Flashcard saved = captor.getValue();
        assertEquals(flashcardId, saved.getId());
        assertEquals("Q1", saved.getQuestion());
        assertEquals("A1", saved.getAnswer());
        assertEquals(mockNote, saved.getNote());
    }

    @Test
    void createFlashcards_whenNoteNotFound_throwsException() {
        UUID flashcardId = UUID.randomUUID();
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);
        when(flashcardRepository.findById(flashcardId)).thenReturn(Optional.empty());
        when(noteRepository.findById(1L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class,
                () -> questionService.createFlashcards(mockToken, List.of(createResponseFlashcard(flashcardId))));
    }

    @Test
    void createFlashcards_whenUnauthorized_throwsException() {
        UUID flashcardId = UUID.randomUUID();
        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(UUID.randomUUID());

        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);
        when(flashcardRepository.findById(flashcardId)).thenReturn(Optional.empty());
        when(noteRepository.findById(1L)).thenReturn(Optional.of(otherNote));

        assertThrows(RuntimeException.class,
                () -> questionService.createFlashcards(mockToken, List.of(createResponseFlashcard(flashcardId))));
    }

    @Test
    void checkFlashcardRelevance_whenNoFlashcards_returnsEmptyList() {
        List<UUID> result = questionService.checkFlashcardRelevance("markdown", List.of());

        assertNotNull(result);
        assertTrue(result.isEmpty());
        verifyNoInteractions(webClient);
    }

    @Test
    void checkFlashcardRelevance_marksStaleFlashcards() {
        UUID flashcardId = UUID.randomUUID();
        ResponseFlashcard flashcard = createResponseFlashcard(flashcardId);

        when(nvidiaProperties.getModel()).thenReturn("test-model");
        when(webClient.requestCompletion(any())).thenReturn(completion("[\"" + flashcardId + "\"]"));

        List<UUID> result = questionService.checkFlashcardRelevance("updated markdown", List.of(flashcard));

        assertEquals(List.of(flashcardId), result);
        verify(flashcardRepository).markStaleByIds(List.of(flashcardId));
    }

    @Test
    void updateStaleFlashcards_updatesFlashcards() {
        UUID flashcardId = UUID.randomUUID();
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));

        Flashcard flashcard = createFlashcard(flashcardId);
        flashcard.setIsStale(false);

        when(flashcardRepository.findById(flashcardId)).thenReturn(Optional.of(flashcard));
        when(flashcardRepository.save(any(Flashcard.class))).thenReturn(flashcard);

        ResponseOperation result = questionService.updateStaleFlashcards(mockToken, 1L, List.of(flashcardId));

        assertTrue(result.getSuccess());
        assertTrue(flashcard.getIsStale());
    }

    @Test
    void updateStaleFlashcards_whenFlashcardNotFound_throwsException() {
        UUID flashcardId = UUID.randomUUID();
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));
        when(flashcardRepository.findById(flashcardId)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class,
                () -> questionService.updateStaleFlashcards(mockToken, 1L, List.of(flashcardId)));
    }

    @Test
    void updateStaleFlashcards_whenUnauthorized_throwsException() {
        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(UUID.randomUUID());

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(otherNote));

        assertThrows(RuntimeException.class,
                () -> questionService.updateStaleFlashcards(mockToken, 1L, List.of(UUID.randomUUID())));
    }

    @Test
    void getDueCards_returnsDueFlashcards() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);

        UUID flashcardId = UUID.randomUUID();
        Flashcard flashcard = createFlashcard(flashcardId);
        flashcard.setLastReviewed(OffsetDateTime.now());

        when(flashcardRepository.findDueCards(mockUser.getId(), LocalDate.now())).thenReturn(List.of(flashcard));

        List<ResponseFlashcard> result = questionService.getDueCards(mockToken);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals(flashcardId, result.get(0).getId());
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
        UUID flashcardId = UUID.randomUUID();
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);

        Flashcard flashcard = createFlashcard(flashcardId);

        when(flashcardRepository.findById(flashcardId)).thenReturn(Optional.of(flashcard));
        when(flashcardRepository.save(any(Flashcard.class))).thenReturn(flashcard);

        ResponseFlashcard responseFlashcard = createResponseFlashcard(flashcardId);
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
        UUID flashcardId = UUID.randomUUID();
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(flashcardRepository.findById(flashcardId)).thenReturn(Optional.empty());

        ResponseFlashcard responseFlashcard = new ResponseFlashcard();
        responseFlashcard.setId(flashcardId);

        assertThrows(RuntimeException.class, () -> questionService.submitReview(mockToken, responseFlashcard));
    }

    @Test
    void getFlashcardsByNoteId_returnsFlashcards() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));

        UUID flashcardId = UUID.randomUUID();
        Flashcard flashcard = createFlashcard(flashcardId);

        when(flashcardRepository.findAllByNoteId(1L)).thenReturn(List.of(flashcard));

        List<ResponseFlashcard> result = questionService.getFlashcardsByNoteId(mockToken, 1L);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals(flashcardId, result.get(0).getId());
        assertEquals("Q1", result.get(0).getQuestion());
    }

    @Test
    void getFlashcardsByNoteId_whenUnauthorized_throwsException() {
        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(UUID.randomUUID());

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(otherNote));

        assertThrows(RuntimeException.class, () -> questionService.getFlashcardsByNoteId(mockToken, 1L));
    }

    @Test
    void deleteStaleFlashcards_deletesStaleFlashcards() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));

        Flashcard staleFlashcard = createFlashcard(UUID.randomUUID());
        staleFlashcard.setIsStale(true);

        Flashcard nonStaleFlashcard = createFlashcard(UUID.randomUUID());
        nonStaleFlashcard.setIsStale(false);

        when(flashcardRepository.findAllByNoteId(1L)).thenReturn(List.of(staleFlashcard, nonStaleFlashcard));

        ResponseOperation result = questionService.deleteStaleFlashcards(mockToken, 1L);

        assertTrue(result.getSuccess());
        verify(flashcardRepository).deleteAll(List.of(staleFlashcard));
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
        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(UUID.randomUUID());

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(otherNote));

        assertThrows(RuntimeException.class, () -> questionService.deleteAllFlashcardsByNoteId(mockToken, 1L));
    }

    @Test
    void deleteFlashcard_deletesFlashcard() {
        UUID flashcardId = UUID.randomUUID();
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);

        Flashcard flashcard = createFlashcard(flashcardId);

        when(flashcardRepository.findById(flashcardId)).thenReturn(Optional.of(flashcard));

        ResponseOperation result = questionService.deleteFlashcard(mockToken, flashcardId);

        assertTrue(result.getSuccess());
        verify(flashcardRepository).delete(flashcard);
    }

    @Test
    void deleteFlashcard_whenNotFound_throwsException() {
        UUID flashcardId = UUID.randomUUID();
        when(flashcardRepository.findById(flashcardId)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> questionService.deleteFlashcard(mockToken, flashcardId));
    }

    @Test
    void deleteFlashcard_whenUnauthorized_throwsException() {
        UUID flashcardId = UUID.randomUUID();
        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(UUID.randomUUID());

        Flashcard flashcard = createFlashcard(flashcardId);
        flashcard.setNote(otherNote);

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(flashcardRepository.findById(flashcardId)).thenReturn(Optional.of(flashcard));

        assertThrows(RuntimeException.class, () -> questionService.deleteFlashcard(mockToken, flashcardId));
    }

    private ResponseCompletion completion(String content) {
        return new ResponseCompletion(List.of(new ResponseChoice(new RequestMessage("assistant", content))));
    }

    private Flashcard createFlashcard(UUID id) {
        Flashcard flashcard = new Flashcard();
        flashcard.setId(id);
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
        return flashcard;
    }

    private ResponseFlashcard createResponseFlashcard(UUID id) {
        return new ResponseFlashcard(
                id,
                "Q1",
                "A1",
                FlashcardType.FACTUAL,
                false,
                false,
                2.5,
                1,
                0,
                LocalDate.now(),
                null,
                1L
        );
    }
}
