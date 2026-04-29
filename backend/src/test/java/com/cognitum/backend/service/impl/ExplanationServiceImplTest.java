package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestCompletion;
import com.cognitum.backend.dto.request.RequestHighlight;
import com.cognitum.backend.dto.request.RequestMessage;
import com.cognitum.backend.dto.response.ResponseCompletion;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.entity.Explanation;
import com.cognitum.backend.entity.Note;
import com.cognitum.backend.properties.NvidiaProperties;
import com.cognitum.backend.repository.ExplanationRepository;
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

import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExplanationServiceImplTest {

    @Mock
    private NvidiaWebClient webClient;

    @Mock
    private NvidiaProperties nvidiaProperties;

    @Mock
    private NoteRepository noteRepository;

    @Mock
    private ExplanationRepository explanationRepository;

    @Mock
    private JwtService jwtService;

    @InjectMocks
    private ExplanationServiceImpl explanationService;

    private ResponseUser mockUser;
    private String mockToken;
    private Note mockNote;

    @BeforeEach
    void setUp() {
        mockToken = "Bearer mockToken";
        mockUser = ResponseUser.builder()
                .email("test@example.com")
                .username("testUser")
                .id(UUID.randomUUID())
                .build();

        mockNote = new Note();
        mockNote.setId(1L);
        mockNote.setText("Test note content");
        mockNote.setUserId(mockUser.getId());
        mockNote.setPath("/test/path");
        mockNote.setCreatedAt(OffsetDateTime.now());
        mockNote.setLastUpdated(OffsetDateTime.now());
    }

    @Test
    void requestExplanation_callsNvidiaWebClient() {
        when(nvidiaProperties.getModel()).thenReturn("test-model");

        ResponseCompletion mockResponse = new ResponseCompletion(null);
        when(webClient.requestCompletion(any())).thenReturn(mockResponse);

        ResponseCompletion result = explanationService.requestExplanation("test concept");

        assertNotNull(result);
        ArgumentCaptor<RequestCompletion> captor =
                ArgumentCaptor.forClass(RequestCompletion.class);
        verify(webClient).requestCompletion(captor.capture());

        RequestCompletion capturedRequest = captor.getValue();
        assertEquals("test-model", capturedRequest.getModel());
        assertEquals(2, capturedRequest.getMessages().size());
        assertEquals(1024, capturedRequest.getMaxTokens());
        assertFalse(capturedRequest.getStream());
    }

    @Test
    void requestExplanation_setsSystemMessage() {
        when(nvidiaProperties.getModel()).thenReturn("test-model");
        when(webClient.requestCompletion(any())).thenReturn(new ResponseCompletion(null));

        explanationService.requestExplanation("Java");

        ArgumentCaptor<RequestCompletion> captor =
                ArgumentCaptor.forClass(RequestCompletion.class);
        verify(webClient).requestCompletion(captor.capture());

        List<RequestMessage> messages = captor.getValue().getMessages();
        assertEquals(2, messages.size());
        assertEquals("system", messages.get(0).getRole());
        assertTrue(messages.get(0).getContent().contains("LaTeX"));
    }

    @Test
    void createExplanation_withValidData_savesExplanation() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));
        when(explanationRepository.save(any(Explanation.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RequestHighlight request = new RequestHighlight();
        request.setId(UUID.randomUUID());
        request.setNoteId(1L);
        request.setSelectedText("selected text");
        request.setExplanation("explanation content");
        request.setFrom(0);
        request.setTo(10);
        request.setCreatedAt(OffsetDateTime.now());

        RequestHighlight result = explanationService.createExplanation(mockToken, request);

        assertNotNull(result.getId());
        verify(explanationRepository).save(any(Explanation.class));
    }

    @Test
    void createExplanation_setsCorrectFields() {
        UUID explanationId = UUID.randomUUID();
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));
        when(explanationRepository.save(any(Explanation.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RequestHighlight request = new RequestHighlight();
        request.setId(explanationId);
        request.setNoteId(1L);
        request.setSelectedText("test selection");
        request.setExplanation("test explanation");
        request.setFrom(5);
        request.setTo(15);
        OffsetDateTime createdAt = OffsetDateTime.now();
        request.setCreatedAt(createdAt);

        explanationService.createExplanation(mockToken, request);

        ArgumentCaptor<Explanation> captor = ArgumentCaptor.forClass(Explanation.class);
        verify(explanationRepository).save(captor.capture());
        Explanation captured = captor.getValue();
        assertEquals(explanationId, captured.getId());
        assertEquals("test selection", captured.getSelectedText());
        assertEquals("test explanation", captured.getExplanation());
        assertEquals(5, captured.getFrom());
        assertEquals(15, captured.getTo());
        assertEquals(createdAt, captured.getCreatedAt());
        assertEquals(mockNote, captured.getNote());
    }

    @Test
    void createExplanation_whenNoteNotFound_throwsException() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(999L)).thenReturn(Optional.empty());

        RequestHighlight request = new RequestHighlight();
        request.setNoteId(999L);

        assertThrows(RuntimeException.class, () -> explanationService.createExplanation(mockToken, request));
    }

    @Test
    void createExplanation_whenUnauthorized_throwsException() {
        UUID otherUserId = UUID.randomUUID();
        ResponseUser.builder()
                .email("other@example.com")
                .id(otherUserId)
                .build();

        Note otherUserNote = new Note();
        otherUserNote.setId(1L);
        otherUserNote.setUserId(otherUserId);

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(otherUserNote));

        RequestHighlight request = new RequestHighlight();
        request.setNoteId(1L);

        assertThrows(RuntimeException.class, () -> explanationService.createExplanation(mockToken, request));
    }

    @Test
    void getExplanationById_whenExists_returnsExplanation() {
        UUID explanationId = UUID.randomUUID();
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);

        Explanation explanation = new Explanation();
        explanation.setId(explanationId);
        explanation.setSelectedText("selected");
        explanation.setFrom(0);
        explanation.setTo(10);
        explanation.setCreatedAt(OffsetDateTime.now());
        explanation.setNote(mockNote);

        when(explanationRepository.findById(explanationId)).thenReturn(Optional.of(explanation));

        RequestHighlight result = explanationService.getExplanationById(mockToken, explanationId);

        assertNotNull(result);
        assertEquals(explanationId, result.getId());
        assertEquals("selected", result.getSelectedText());
        assertEquals(0, result.getFrom());
        assertEquals(10, result.getTo());
        assertEquals(1L, result.getNoteId());
    }

    @Test
    void getExplanationById_whenNotFound_throwsException() {
        UUID explanationId = UUID.randomUUID();
        when(explanationRepository.findById(explanationId)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> explanationService.getExplanationById(mockToken, explanationId));
    }

    @Test
    void getExplanationById_whenUnauthorized_throwsException() {
        UUID explanationId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();

        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(otherUserId);

        Explanation explanation = new Explanation();
        explanation.setId(explanationId);
        explanation.setNote(otherNote);

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(explanationRepository.findById(explanationId)).thenReturn(Optional.of(explanation));

        assertThrows(RuntimeException.class, () -> explanationService.getExplanationById(mockToken, explanationId));
    }

    @Test
    void getExplanationsByNoteId_whenExists_returnsExplanations() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));

        UUID explanationId1 = UUID.randomUUID();
        UUID explanationId2 = UUID.randomUUID();

        Explanation explanation1 = new Explanation();
        explanation1.setId(explanationId1);
        explanation1.setSelectedText("text 1");
        explanation1.setFrom(0);
        explanation1.setTo(5);
        explanation1.setCreatedAt(OffsetDateTime.now());
        explanation1.setNote(mockNote);

        Explanation explanation2 = new Explanation();
        explanation2.setId(explanationId2);
        explanation2.setSelectedText("text 2");
        explanation2.setFrom(10);
        explanation2.setTo(20);
        explanation2.setCreatedAt(OffsetDateTime.now());
        explanation2.setNote(mockNote);

        mockNote.setExplanations(Arrays.asList(explanation1, explanation2));

        List<RequestHighlight> result = explanationService.getExplanationsByNoteId(mockToken, 1L);

        assertNotNull(result);
        assertEquals(2, result.size());
    }

    @Test
    void getExplanationsByNoteId_whenNoteNotFound_throwsException() {
        when(noteRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> explanationService.getExplanationsByNoteId(mockToken, 999L));
    }

    @Test
    void getExplanationsByNoteId_whenUnauthorized_throwsException() {
        UUID otherUserId = UUID.randomUUID();
        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(otherUserId);

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(otherNote));

        assertThrows(RuntimeException.class, () -> explanationService.getExplanationsByNoteId(mockToken, 1L));
    }

    @Test
    void deleteExplanation_whenExists_deletesExplanation() {
        UUID explanationId = UUID.randomUUID();
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);

        Explanation explanation = new Explanation();
        explanation.setId(explanationId);
        explanation.setNote(mockNote);

        when(explanationRepository.findById(explanationId)).thenReturn(Optional.of(explanation));

        ResponseOperation result = explanationService.deleteExplanation(mockToken, explanationId);

        assertTrue(result.getSuccess());
        verify(explanationRepository).delete(explanation);
    }

    @Test
    void deleteExplanation_whenNotFound_throwsException() {
        UUID explanationId = UUID.randomUUID();
        when(explanationRepository.findById(explanationId)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> explanationService.deleteExplanation(mockToken, explanationId));
    }

    @Test
    void deleteExplanation_whenUnauthorized_throwsException() {
        UUID explanationId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();

        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(otherUserId);

        Explanation explanation = new Explanation();
        explanation.setId(explanationId);
        explanation.setNote(otherNote);

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(explanationRepository.findById(explanationId)).thenReturn(Optional.of(explanation));

        assertThrows(RuntimeException.class, () -> explanationService.deleteExplanation(mockToken, explanationId));
    }
}
