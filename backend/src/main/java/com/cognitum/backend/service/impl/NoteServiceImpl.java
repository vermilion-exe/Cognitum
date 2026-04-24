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

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NoteServiceImpl implements NoteService {

    private final NoteRepository noteRepository;
    private final JwtService jwtService;

    @Override
    public List<ResponseNote> getNotes(String token) {
        ResponseUser user = jwtService.getTokenInfo(token);
        List<Note> notes = noteRepository.findAllByUserId(user.getId());

        return notes.stream()
                .map(note -> new ResponseNote(note.getId(), note.getText(), note.getPath(), note.getCreatedAt(), note.getLastUpdated()))
                .toList();
    }

    @Override
    public ResponseNote createNote(String token, RequestNote request) {
        ResponseUser user = jwtService.getTokenInfo(token);

        Note note = new Note();

        if (request.getId() != null) {
            Note existingNote = noteRepository.findById(request.getId())
                    .orElseThrow(() -> new NotFoundException("Note not found"));

            if (!existingNote.getUserId().equals(user.getId())) {
                throw new UnauthorizedException("Cannot modify another user's note");
            }

            note.setFlashcards(existingNote.getFlashcards());
            note.setExplanations(existingNote.getExplanations());
        }

        note.setId(request.getId());
        note.setText(request.getText());
        note.setPath(request.getPath());
        note.setUserId(user.getId());
        note.setCreatedAt(request.getCreatedAt());
        note.setLastUpdated(request.getLastUpdated());

        Note savedNote = noteRepository.save(note);

        return new ResponseNote(savedNote.getId(), savedNote.getText(), savedNote.getPath(), savedNote.getCreatedAt(), savedNote.getLastUpdated());
    }

    @Override
    public ResponseNote getNoteByPath(String token, String path) {
        ResponseUser user = jwtService.getTokenInfo(token);
        Note note = noteRepository.findByUserIdAndPath(user.getId(), path)
                .orElseThrow(() -> new NotFoundException("Note not found"));

        return new ResponseNote(note.getId(), note.getText(), note.getPath(), note.getCreatedAt(), note.getLastUpdated());
    }

    @Override
    public List<ResponseNote> getNotesSince(String token, OffsetDateTime timestamp) {
        ResponseUser user = jwtService.getTokenInfo(token);
        List<Note> notes = noteRepository.findAllByUserIdAndLastUpdatedAfter(user.getId(), timestamp);

        return notes.stream()
                .map(note -> new ResponseNote(note.getId(), note.getText(), note.getPath(), note.getCreatedAt(), note.getLastUpdated()))
                .toList();
    }

    @Override
    public ResponseNote moveNote(String token, String oldPath, String newPath) {
        ResponseUser user = jwtService.getTokenInfo(token);
        Note note = noteRepository.findByUserIdAndPath(user.getId(), oldPath)
                .orElseThrow(() -> new NotFoundException("Note not found"));

        note.setPath(newPath);
        Note updatedNote = noteRepository.save(note);

        return new ResponseNote(updatedNote.getId(), updatedNote.getText(), updatedNote.getPath(), updatedNote.getCreatedAt(), updatedNote.getLastUpdated());
    }

    @Override
    public ResponseOperation deleteNote(String token, String path) {
        ResponseUser user = jwtService.getTokenInfo(token);
        Note note = noteRepository.findByUserIdAndPath(user.getId(), path)
                .orElseThrow(() -> new NotFoundException("Note not found"));

        noteRepository.delete(note);

        return new ResponseOperation(true);
    }

}
