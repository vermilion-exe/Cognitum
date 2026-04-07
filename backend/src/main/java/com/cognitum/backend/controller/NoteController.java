package com.cognitum.backend.controller;

import com.cognitum.backend.dto.request.RequestNote;
import com.cognitum.backend.dto.response.ResponseNote;
import com.cognitum.backend.service.NoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/cognitum/note")
public class NoteController {

    private final NoteService noteService;

    @GetMapping
    public List<ResponseNote> getNotes(@RequestHeader("Authorization") String token) {
        return noteService.getNotes(token);
    }

    @GetMapping("/path")
    public ResponseNote getNoteByPath(@RequestHeader("Authorization") String token, @RequestParam String path) {
        return noteService.getNoteByPath(token, path);
    }

    @PostMapping
    public ResponseNote createNote(String token, RequestNote request) {
        return noteService.createNote(token, request);
    }

}
