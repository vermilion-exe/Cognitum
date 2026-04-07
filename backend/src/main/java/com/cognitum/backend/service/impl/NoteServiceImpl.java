package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestNote;
import com.cognitum.backend.dto.response.ResponseNote;
import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.entity.Note;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.service.JwtService;
import com.cognitum.backend.service.NoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
                .map(note -> new ResponseNote(note.getId(), note.getText(), note.getPath()))
                .toList();
    }

    @Override
    public ResponseNote createNote(String token, RequestNote request) {
        ResponseUser user = jwtService.getTokenInfo(token);

        Note note = new Note();
        note.setId(request.getId());
        note.setText(request.getText());
        note.setPath(request.getPath());
        note.setUserId(user.getId());

        Note savedNote = noteRepository.save(note);

        return new ResponseNote(savedNote.getId(), savedNote.getText(), savedNote.getPath());
    }

    @Override
    public ResponseNote getNoteByPath(String token, String path) {
        ResponseUser user = jwtService.getTokenInfo(token);
        Note note = noteRepository.findByUserIdAndPath(user.getId(), path)
                .orElseThrow(() -> new RuntimeException("Note not found"));

        return new ResponseNote(note.getId(), note.getText(), note.getPath());
    }

}
