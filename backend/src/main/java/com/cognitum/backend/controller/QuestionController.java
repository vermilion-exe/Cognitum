package com.cognitum.backend.controller;

import com.cognitum.backend.dto.response.ResponseFlashcard;
import com.cognitum.backend.service.QuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/cognitum/question")
public class QuestionController {

    private final QuestionService questionService;

    @PostMapping("/flashcards")
    public List<ResponseFlashcard> generateFlashcards(String token, Long noteId) {
        return questionService.generateFlashcards(token, noteId);
    }

}
