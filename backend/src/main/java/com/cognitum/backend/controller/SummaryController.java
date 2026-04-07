package com.cognitum.backend.controller;

import com.cognitum.backend.dto.request.RequestSummary;
import com.cognitum.backend.dto.response.ResponseSummary;
import com.cognitum.backend.service.SummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/cognitum/summary")
public class SummaryController {

    private final SummaryService summaryService;

    @PostMapping("/summarize")
    public ResponseSummary summarize(@RequestHeader("Authorization") String token,
                                     @RequestBody RequestSummary requestSummary) {
        return summaryService.summarize(requestSummary);
    }

    @GetMapping("/note")
    public ResponseSummary getSummaryByNoteId(@RequestHeader("Authorization") String token,
                                            @RequestParam Long noteId) {
        return summaryService.getSummaryByNoteId(token, noteId);
    }

    @PostMapping
    public void createSummary(@RequestHeader("Authorization") String token,
                             @RequestBody ResponseSummary request) {
        summaryService.createSummary(token, request);
    }

}
