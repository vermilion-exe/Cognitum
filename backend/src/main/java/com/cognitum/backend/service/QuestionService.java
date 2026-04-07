package com.cognitum.backend.service;

import com.cognitum.backend.dto.response.ResponseFlashcard;

import java.util.List;

public interface QuestionService {

    List<ResponseFlashcard> generateFlashcards(String token, Long noteId);

}
