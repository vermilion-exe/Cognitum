package com.cognitum.backend.service;

import com.cognitum.backend.dto.request.RequestHighlight;
import com.cognitum.backend.dto.response.ResponseCompletion;

import java.util.UUID;

public interface ExplanationService {

    ResponseCompletion requestExplanation(String text);
    void createExplanation(String token, RequestHighlight request);
    RequestHighlight getExplanationById(String token, UUID id);

}
