package com.cognitum.backend.service;

import com.cognitum.backend.dto.request.RequestNote;
import com.cognitum.backend.dto.response.ResponseNote;

import java.util.List;

public interface NoteService {

    List<ResponseNote> getNotes(String token);
    ResponseNote createNote(String token, RequestNote requestNote);
    ResponseNote getNoteByPath(String token, String path);

}
