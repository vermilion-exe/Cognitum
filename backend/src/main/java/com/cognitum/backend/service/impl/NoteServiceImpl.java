package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestNote;
import com.cognitum.backend.dto.response.ResponseNote;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.entity.Note;
import com.cognitum.backend.exception.NotFoundException;
import com.cognitum.backend.exception.UnauthorizedException;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.service.JwtService;
import com.cognitum.backend.service.NoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NoteServiceImpl implements NoteService {

    private final NoteRepository noteRepository;
    private final JwtService jwtService;

    @Override
    public List<ResponseNote> getNotes(String token) {
        // Return only notes owned by the authenticated user
        ResponseUser user = jwtService.getTokenInfo(token);
        List<Note> notes = noteRepository.findAllByUserId(user.getId());

        return notes.stream()
                .map(note -> new ResponseNote(note.getId(), note.getText(), note.getPath(), note.getCreatedAt(), note.getLastUpdated()))
                .toList();
    }

    @Override
    public ResponseNote createNote(String token, RequestNote request) {
        ResponseUser user = jwtService.getTokenInfo(token);

        // Use the client timestamp when sync provides one
        OffsetDateTime requestLastUpdated = request.getLastUpdated() != null
                ? request.getLastUpdated()
                : OffsetDateTime.now();
        Note note;

        if (request.getId() != null) {
            // Updating by id must still belong to the current user
            note = noteRepository.findById(request.getId())
                    .orElseThrow(() -> new NotFoundException("Note not found"));

            if (!note.getUserId().equals(user.getId())) {
                throw new UnauthorizedException("Cannot modify another user's note");
            }
        } else {
            // Otherwise upsert the latest note with the same path
            note = noteRepository.findFirstByUserIdAndPathOrderByLastUpdatedDesc(user.getId(), request.getPath())
                    .orElseGet(Note::new);
        }

        // Ignore stale writes so older sync data cannot overwrite newer notes
        if (note.getId() != null && note.getLastUpdated() != null && requestLastUpdated.isBefore(note.getLastUpdated())) {
            return toResponseNote(note);
        }

        note.setText(request.getText());
        note.setPath(request.getPath());
        note.setUserId(user.getId());
        note.setCreatedAt(request.getCreatedAt() != null
                ? request.getCreatedAt()
                : note.getCreatedAt() != null ? note.getCreatedAt() : OffsetDateTime.now());
        note.setLastUpdated(requestLastUpdated);

        Note savedNote = noteRepository.save(note);

        return toResponseNote(savedNote);
    }

    @Override
    public void updateNoteTimestamp(Note note) {
        // Mark related data changes as note updates for sync
        note.setLastUpdated(OffsetDateTime.now());
        noteRepository.save(note);
    }

    @Override
    public ResponseNote getNoteByPath(String token, String path) {
        ResponseUser user = jwtService.getTokenInfo(token);
        Note note = noteRepository.findFirstByUserIdAndPathOrderByLastUpdatedDesc(user.getId(), path)
                .orElseThrow(() -> new NotFoundException("Note not found"));

        return new ResponseNote(note.getId(), note.getText(), note.getPath(), note.getCreatedAt(), note.getLastUpdated());
    }

    @Override
    public List<ResponseNote> getNotesSince(String token, OffsetDateTime timestamp) {
        // Incremental sync asks for notes changed after a saved timestamp
        ResponseUser user = jwtService.getTokenInfo(token);
        List<Note> notes = noteRepository.findAllByUserIdAndLastUpdatedAfter(user.getId(), timestamp);

        return notes.stream()
                .map(note -> new ResponseNote(note.getId(), note.getText(), note.getPath(), note.getCreatedAt(), note.getLastUpdated()))
                .toList();
    }

    @Override
    public ResponseNote moveNote(String token, String oldPath, String newPath) {
        // Keep the server path aligned with a local file rename or move
        ResponseUser user = jwtService.getTokenInfo(token);
        Note note = noteRepository.findFirstByUserIdAndPathOrderByLastUpdatedDesc(user.getId(), oldPath)
                .orElseThrow(() -> new NotFoundException("Note not found"));

        note.setPath(newPath);
        Note updatedNote = noteRepository.save(note);

        return new ResponseNote(updatedNote.getId(), updatedNote.getText(), updatedNote.getPath(), updatedNote.getCreatedAt(), updatedNote.getLastUpdated());
    }

    @Override
    public ResponseOperation deleteNote(String token, String path) {
        // Delete the user's latest note at the requested path
        ResponseUser user = jwtService.getTokenInfo(token);
        Note note = noteRepository.findFirstByUserIdAndPathOrderByLastUpdatedDesc(user.getId(), path)
                .orElseThrow(() -> new NotFoundException("Note not found"));

        noteRepository.delete(note);

        return new ResponseOperation(true);
    }

    private ResponseNote toResponseNote(Note note) {
        return new ResponseNote(note.getId(), note.getText(), note.getPath(), note.getCreatedAt(), note.getLastUpdated());
    }

}
