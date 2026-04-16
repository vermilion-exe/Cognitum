package com.cognitum.backend.service;

import com.cognitum.backend.dto.request.RequestHighlight;
import com.cognitum.backend.dto.response.ResponseCompletion;
import com.cognitum.backend.dto.response.ResponseOperation;

import java.util.List;
import java.util.UUID;

public interface ExplanationService {

    ResponseCompletion requestExplanation(String text);
    ResponseOperation createExplanation(String token, RequestHighlight request);
    RequestHighlight getExplanationById(String token, UUID id);
    List<RequestHighlight> getExplanationsByNoteId(String token, Long noteId);
    ResponseOperation deleteExplanation(String token, UUID id);

}
