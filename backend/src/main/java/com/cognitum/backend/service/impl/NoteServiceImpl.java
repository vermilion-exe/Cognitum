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
    public void createNote(String token, RequestNote request) {
        ResponseUser user = jwtService.getTokenInfo(token);

        Note note = new Note();
        note.setId(request.getId());
        note.setText(request.getText());
        note.setPath(request.getPath());
        note.setUserId(user.getId());

        noteRepository.save(note);
    }

}
