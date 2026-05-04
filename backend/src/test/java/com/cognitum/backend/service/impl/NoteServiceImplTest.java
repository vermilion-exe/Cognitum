package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestNote;
import com.cognitum.backend.dto.response.ResponseNote;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.entity.Note;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.service.JwtService;
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
class NoteServiceImplTest {

    @Mock
    private NoteRepository noteRepository;

    @Mock
    private JwtService jwtService;

    @InjectMocks
    private NoteServiceImpl noteService;

    private ResponseUser mockUser;
    private String mockToken;

    @BeforeEach
    void setUp() {
        mockToken = "Bearer mockToken";
        mockUser = ResponseUser.builder()
                .email("test@example.com")
                .username("testUser")
                .id(UUID.randomUUID())
                .build();
    }

    @Test
    void getNotes_whenNotesExist_returnsNotes() {
        UUID userId = mockUser.getId();
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);
        when(noteRepository.findAllByUserId(userId)).thenReturn(Arrays.asList(createNote("Note 1"), createNote("Note 2")));

        List<ResponseNote> result = noteService.getNotes(mockToken);

        assertNotNull(result);
        assertEquals(2, result.size());
        verify(jwtService).getTokenInfo(mockToken);
        verify(noteRepository).findAllByUserId(userId);
    }

    @Test
    void getNotes_whenNoNotes_returnsEmptyList() {
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);
        when(noteRepository.findAllByUserId(mockUser.getId())).thenReturn(List.of());

        List<ResponseNote> result = noteService.getNotes(mockToken);

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void createNote_withValidData_savesNote() {
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);

        RequestNote requestNote = new RequestNote();
        requestNote.setText("Test note content");
        requestNote.setPath("/path/to/note");
        requestNote.setCreatedAt(OffsetDateTime.now());
        requestNote.setLastUpdated(OffsetDateTime.now());

        Note savedNote = createNote("Test note content");
        savedNote.setId(1L);
        when(noteRepository.save(any(Note.class))).thenReturn(savedNote);

        ResponseNote result = noteService.createNote(mockToken, requestNote);

        assertNotNull(result);
        assertEquals("Test note content", result.getText());
        verify(noteRepository).save(any(Note.class));
    }

    @Test
    void createNote_setsCorrectUserId() {
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);

        RequestNote requestNote = new RequestNote();
        requestNote.setText("Test content");
        requestNote.setPath("/test");
        requestNote.setCreatedAt(OffsetDateTime.now());
        requestNote.setLastUpdated(OffsetDateTime.now());

        Note savedNote = createNote("Test content");
        when(noteRepository.save(any(Note.class))).thenReturn(savedNote);

        noteService.createNote(mockToken, requestNote);

        ArgumentCaptor<Note> captor = ArgumentCaptor.forClass(Note.class);
        verify(noteRepository).save(captor.capture());
        Note capturedNote = captor.getValue();
        assertEquals(mockUser.getId(), capturedNote.getUserId());
    }

    @Test
    void createNote_withoutIdWhenPathExists_updatesExistingNote() {
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);

        OffsetDateTime originalCreatedAt = OffsetDateTime.now().minusDays(1);
        Note existingNote = createNote("Original content");
        existingNote.setId(7L);
        existingNote.setPath("/test/path");
        existingNote.setCreatedAt(originalCreatedAt);
        existingNote.setLastUpdated(OffsetDateTime.now().minusHours(1));

        RequestNote requestNote = new RequestNote();
        requestNote.setText("Updated content");
        requestNote.setPath("/test/path");
        requestNote.setLastUpdated(OffsetDateTime.now());

        when(noteRepository.findFirstByUserIdAndPathOrderByLastUpdatedDesc(mockUser.getId(), "/test/path"))
                .thenReturn(Optional.of(existingNote));
        when(noteRepository.save(any(Note.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ResponseNote result = noteService.createNote(mockToken, requestNote);

        assertEquals(7L, result.getId());
        assertEquals("Updated content", result.getText());
        assertEquals(originalCreatedAt, result.getCreatedAt());
        verify(noteRepository).save(existingNote);
    }

    @Test
    void createNote_withoutIdWhenPathExistsAndRequestIsOlder_doesNotOverwrite() {
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);

        OffsetDateTime existingLastUpdated = OffsetDateTime.now();
        Note existingNote = createNote("Newer content");
        existingNote.setId(7L);
        existingNote.setPath("/test/path");
        existingNote.setLastUpdated(existingLastUpdated);

        RequestNote requestNote = new RequestNote();
        requestNote.setText("Older content");
        requestNote.setPath("/test/path");
        requestNote.setLastUpdated(existingLastUpdated.minusMinutes(1));

        when(noteRepository.findFirstByUserIdAndPathOrderByLastUpdatedDesc(mockUser.getId(), "/test/path"))
                .thenReturn(Optional.of(existingNote));

        ResponseNote result = noteService.createNote(mockToken, requestNote);

        assertEquals(7L, result.getId());
        assertEquals("Newer content", result.getText());
        verify(noteRepository, never()).save(any(Note.class));
    }

    @Test
    void getNoteByPath_whenNoteExists_returnsNote() {
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);

        Note existingNote = createNote("Existing note");
        existingNote.setPath("/existing/path");
        when(noteRepository.findFirstByUserIdAndPathOrderByLastUpdatedDesc(mockUser.getId(), "/existing/path"))
                .thenReturn(Optional.of(existingNote));

        ResponseNote result = noteService.getNoteByPath(mockToken, "/existing/path");

        assertNotNull(result);
        assertEquals("Existing note", result.getText());
    }

    @Test
    void getNoteByPath_whenNoteNotFound_throwsException() {
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);
        when(noteRepository.findFirstByUserIdAndPathOrderByLastUpdatedDesc(any(), any())).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> noteService.getNoteByPath(mockToken, "/nonexistent"));
    }

    @Test
    void moveNote_whenNoteExists_updatesPath() {
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);

        Note existingNote = createNote("Note to move");
        existingNote.setPath("/old/path");
        when(noteRepository.findFirstByUserIdAndPathOrderByLastUpdatedDesc(mockUser.getId(), "/old/path"))
                .thenReturn(Optional.of(existingNote));
        when(noteRepository.save(any(Note.class))).thenReturn(existingNote);

        noteService.moveNote(mockToken, "/old/path", "/new/path");

        assertEquals("/new/path", existingNote.getPath());
        verify(noteRepository).save(existingNote);
    }

    @Test
    void deleteNote_whenNoteExists_deletesNote() {
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);

        Note existingNote = createNote("Note to delete");
        existingNote.setPath("/to/delete");
        when(noteRepository.findFirstByUserIdAndPathOrderByLastUpdatedDesc(mockUser.getId(), "/to/delete"))
                .thenReturn(Optional.of(existingNote));

        ResponseOperation result = noteService.deleteNote(mockToken, "/to/delete");

        assertNotNull(result);
        verify(noteRepository).delete(existingNote);
    }

    @Test
    void getNotesSince_filtersByTimestamp() {
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);

        OffsetDateTime timestamp = OffsetDateTime.now().minusDays(1);
        Note note1 = createNote("Note 1");
        note1.setLastUpdated(OffsetDateTime.now());
        Note note2 = createNote("Note 2");
        note2.setLastUpdated(OffsetDateTime.now().minusDays(2));

        when(noteRepository.findAllByUserIdAndLastUpdatedAfter(mockUser.getId(), timestamp))
                .thenReturn(List.of(note1));

        List<ResponseNote> result = noteService.getNotesSince(mockToken, timestamp);

        assertEquals(1, result.size());
    }

    @Test
    void createNote_withId_updatesExistingNote() {
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);

        Long existingId = 1L;
        Note existingNote = createNote("Original content");
        existingNote.setId(existingId);
        existingNote.setUserId(mockUser.getId());

        RequestNote requestNote = new RequestNote();
        requestNote.setId(existingId);
        requestNote.setText("Updated content");
        requestNote.setPath("/updated");
        requestNote.setCreatedAt(OffsetDateTime.now());
        requestNote.setLastUpdated(OffsetDateTime.now());

        when(noteRepository.findById(existingId)).thenReturn(Optional.of(existingNote));
        when(noteRepository.save(any(Note.class))).thenReturn(existingNote);

        noteService.createNote(mockToken, requestNote);

        ArgumentCaptor<Note> captor = ArgumentCaptor.forClass(Note.class);
        verify(noteRepository).save(captor.capture());
        Note capturedNote = captor.getValue();
        assertEquals("Updated content", capturedNote.getText());
    }

    @Test
    void createNote_withUnauthorizedUser_throwsException() {
        when(jwtService.getTokenInfo(mockToken)).thenReturn(mockUser);

        Long existingId = 1L;
        Note existingNote = createNote("Original");
        existingNote.setId(existingId);
        existingNote.setUserId(UUID.randomUUID());

        RequestNote requestNote = new RequestNote();
        requestNote.setId(existingId);
        requestNote.setText("Updated");
        requestNote.setPath("/test");
        requestNote.setCreatedAt(OffsetDateTime.now());
        requestNote.setLastUpdated(OffsetDateTime.now());

        when(noteRepository.findById(existingId)).thenReturn(Optional.of(existingNote));

        assertThrows(RuntimeException.class, () -> noteService.createNote(mockToken, requestNote));
    }

    private Note createNote(String text) {
        Note note = new Note();
        note.setText(text);
        note.setUserId(mockUser != null ? mockUser.getId() : UUID.randomUUID());
        note.setPath("/test/path");
        note.setCreatedAt(OffsetDateTime.now());
        note.setLastUpdated(OffsetDateTime.now());
        return note;
    }
}
