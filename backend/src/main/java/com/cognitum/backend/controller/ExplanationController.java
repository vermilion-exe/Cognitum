package com.cognitum.backend.controller;

import com.cognitum.backend.dto.response.ResponseCompletion;
import com.cognitum.backend.service.ExplanationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/cognitum/explanation")
public class ExplanationController {

    private final ExplanationService explanationService;

    @PostMapping("/explain")
    ResponseCompletion requestExplanation(@RequestBody String text) {
        return explanationService.requestExplanation(text);
    }

}
