package com.cognitum.backend.controller;

import com.cognitum.backend.dto.request.RequestNote;
import com.cognitum.backend.dto.response.ResponseNote;
import com.cognitum.backend.service.NoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
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

    @GetMapping("/since")
    public List<ResponseNote> getNotesSince(@RequestHeader("Authorization") String token, @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime timestamp) {
        return noteService.getNotesSince(token, timestamp);
    }

    @PostMapping
    public ResponseNote createNote(@RequestHeader("Authorization") String token, @RequestBody RequestNote request) {
        return noteService.createNote(token, request);
    }

}
