package com.cognitum.backend.service;

import com.cognitum.backend.dto.request.RequestNote;
import com.cognitum.backend.dto.response.ResponseNote;
import com.cognitum.backend.dto.response.ResponseOperation;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;

public interface NoteService {

    List<ResponseNote> getNotes(String token);
    ResponseNote createNote(String token, RequestNote requestNote);
    ResponseNote getNoteByPath(String token, String path);
    List<ResponseNote> getNotesSince(String token, OffsetDateTime timestamp);
    ResponseNote moveNote(String token, String oldPath, String newPath);
    ResponseOperation deleteNote(String token, String path);

}
