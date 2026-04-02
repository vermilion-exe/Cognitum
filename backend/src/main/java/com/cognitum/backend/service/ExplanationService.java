package com.cognitum.backend.service;

import com.cognitum.backend.dto.response.ResponseExplanation;

public interface ExplanationService {

    ResponseExplanation requestExplanation(String text);

}
