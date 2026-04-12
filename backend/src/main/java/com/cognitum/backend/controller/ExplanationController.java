package com.cognitum.backend.controller;

import com.cognitum.backend.dto.request.RequestHighlight;
import com.cognitum.backend.dto.response.ResponseCompletion;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.service.ExplanationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/cognitum/explanation")
public class ExplanationController {

    private final ExplanationService explanationService;

    @PostMapping("/explain")
    ResponseCompletion requestExplanation(@RequestBody String text) {
        return explanationService.requestExplanation(text);
    }

    @GetMapping("/note")
    public List<RequestHighlight> getExplanationsByNoteId(@RequestHeader("Authorization") String token,
                                                          @RequestParam Long noteId) {
        return explanationService.getExplanationsByNoteId(token, noteId);
    }

     @PostMapping
    public ResponseOperation createExplanation(@RequestHeader("Authorization") String token,
                                               @RequestBody RequestHighlight request) {
            return explanationService.createExplanation(token, request);
     }

}
