package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestSummary;
import com.cognitum.backend.dto.response.ResponseSummary;
import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.entity.Note;
import com.cognitum.backend.entity.Summary;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.repository.SummaryRepository;
import com.cognitum.backend.service.JwtService;
import com.cognitum.backend.web.AISummaryWebClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SummaryServiceImplTest {

    @Mock
    private AISummaryWebClient webClient;

    @Mock
    private JwtService jwtService;

    @Mock
    private SummaryRepository summaryRepository;

    @Mock
    private NoteRepository noteRepository;

    @InjectMocks
    private SummaryServiceImpl summaryService;

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
        mockNote.setText("Test note content for summarization");
        mockNote.setUserId(mockUser.getId());
        mockNote.setPath("/test/path");
        mockNote.setCreatedAt(OffsetDateTime.now());
        mockNote.setLastUpdated(OffsetDateTime.now());
    }

    @Test
    void summarize_callsWebClient() {
        RequestSummary requestSummary = new RequestSummary();
        requestSummary.setMarkdown("# Test");
        requestSummary.setMaxNewTokens(100);
        requestSummary.setRecursive(false);

        ResponseSummary mockResponse = new ResponseSummary(UUID.randomUUID(), "Summary text", 1L);
        when(webClient.summarize(any(RequestSummary.class))).thenReturn(mockResponse);

        ResponseSummary result = summaryService.summarize(requestSummary);

        assertNotNull(result);
        verify(webClient).summarize(requestSummary);
    }

    @Test
    void summarize_passesCorrectParameters() {
        RequestSummary requestSummary = new RequestSummary();
        requestSummary.setMarkdown("# Content");
        requestSummary.setMaxNewTokens(200);
        requestSummary.setRecursive(true);

        when(webClient.summarize(any(RequestSummary.class))).thenReturn(new ResponseSummary());

        summaryService.summarize(requestSummary);

        ArgumentCaptor<RequestSummary> captor = ArgumentCaptor.forClass(RequestSummary.class);
        verify(webClient).summarize(captor.capture());

        RequestSummary captured = captor.getValue();
        assertEquals("# Content", captured.getMarkdown());
        assertEquals(200, captured.getMaxNewTokens());
        assertTrue(captured.getRecursive());
    }

    @Test
    void getSummaryByNoteId_whenSummaryExists_returnsSummary() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);

        Summary summary = new Summary();
        summary.setId(UUID.randomUUID());
        summary.setSummary("Test summary content");
        summary.setNote(mockNote);

        when(summaryRepository.getSummaryByNoteId(1L)).thenReturn(Optional.of(summary));

        ResponseSummary result = summaryService.getSummaryByNoteId(mockToken, 1L);

        assertNotNull(result);
        assertEquals("Test summary content", result.getSummary());
        assertEquals(1L, result.getNoteId());
    }

    @Test
    void getSummaryByNoteId_whenSummaryNotFound_throwsException() {
        when(summaryRepository.getSummaryByNoteId(1L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> summaryService.getSummaryByNoteId(mockToken, 1L));
    }

    @Test
    void getSummaryByNoteId_whenUnauthorized_throwsException() {
        UUID otherUserId = UUID.randomUUID();
        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(otherUserId);

        Summary summary = new Summary();
        summary.setId(UUID.randomUUID());
        summary.setNote(otherNote);

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(summaryRepository.getSummaryByNoteId(1L)).thenReturn(Optional.of(summary));

        assertThrows(RuntimeException.class, () -> summaryService.getSummaryByNoteId(mockToken, 1L));
    }

    @Test
    void createSummary_withValidData_savesSummary() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));
        when(summaryRepository.getSummaryByNoteId(1L)).thenReturn(Optional.empty());
        when(summaryRepository.save(any(Summary.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ResponseSummary request = new ResponseSummary(UUID.randomUUID(), "New summary", 1L);

        ResponseSummary result = summaryService.createSummary(mockToken, request);

        assertNotNull(result.getId());
        verify(summaryRepository).save(any(Summary.class));
    }

    @Test
    void createSummary_setsCorrectFields() {
        UUID summaryId = UUID.randomUUID();
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));
        when(summaryRepository.getSummaryByNoteId(1L)).thenReturn(Optional.empty());
        when(summaryRepository.save(any(Summary.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ResponseSummary request = new ResponseSummary(summaryId, "Summary content", 1L);

        summaryService.createSummary(mockToken, request);

        ArgumentCaptor<Summary> captor = ArgumentCaptor.forClass(Summary.class);
        verify(summaryRepository).save(captor.capture());
        Summary captured = captor.getValue();
        assertEquals(summaryId, captured.getId());
        assertEquals("Summary content", captured.getSummary());
        assertEquals(mockNote, captured.getNote());
    }

    @Test
    void createSummary_whenNoteNotFound_throwsException() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(999L)).thenReturn(Optional.empty());

        ResponseSummary request = new ResponseSummary(UUID.randomUUID(), "Summary", 999L);

        assertThrows(RuntimeException.class, () -> summaryService.createSummary(mockToken, request));
    }

    @Test
    void createSummary_whenSummaryExistsForOtherUser_throwsException() {
        UUID otherUserId = UUID.randomUUID();
        Note otherNote = new Note();
        otherNote.setId(1L);
        otherNote.setUserId(otherUserId);

        Summary existingSummary = new Summary();
        existingSummary.setId(UUID.randomUUID());
        existingSummary.setNote(otherNote);

        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(summaryRepository.getSummaryByNoteId(1L)).thenReturn(Optional.of(existingSummary));

        ResponseSummary request = new ResponseSummary(UUID.randomUUID(), "New summary", 1L);

        assertThrows(RuntimeException.class, () -> summaryService.createSummary(mockToken, request));
    }

    @Test
    void createSummary_whenSummaryExistsForCurrentUser_updatesSummary() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));
        when(summaryRepository.save(any(Summary.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Summary existingSummary = new Summary();
        existingSummary.setId(UUID.randomUUID());
        existingSummary.setSummary("Old summary");
        existingSummary.setNote(mockNote);

        when(summaryRepository.getSummaryByNoteId(1L)).thenReturn(Optional.of(existingSummary));

        ResponseSummary request = new ResponseSummary(UUID.randomUUID(), "Updated summary", 1L);

        ResponseSummary result = summaryService.createSummary(mockToken, request);

        assertNotNull(result.getId());
        verify(summaryRepository).save(any(Summary.class));
    }

    @Test
    void createSummary_withNewId_createsNewSummary() {
        when(jwtService.getTokenInfo(anyString())).thenReturn(mockUser);
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mockNote));
        when(summaryRepository.getSummaryByNoteId(1L)).thenReturn(Optional.empty());
        when(summaryRepository.save(any(Summary.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UUID newId = UUID.randomUUID();
        ResponseSummary request = new ResponseSummary(newId, "New summary", 1L);

        summaryService.createSummary(mockToken, request);

        ArgumentCaptor<Summary> captor = ArgumentCaptor.forClass(Summary.class);
        verify(summaryRepository).save(captor.capture());
        assertEquals(newId, captor.getValue().getId());
    }
}
