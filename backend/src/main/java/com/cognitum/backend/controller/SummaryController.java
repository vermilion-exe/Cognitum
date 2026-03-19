package com.cognitum.backend.controller;

import com.cognitum.backend.dto.request.RequestSummary;
import com.cognitum.backend.dto.response.ResponseSummary;
import com.cognitum.backend.service.SummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/cognitum/summary")
public class SummaryController {

    private final SummaryService summaryService;

    @PostMapping("/summarize")
    public ResponseSummary summarize(@RequestBody RequestSummary requestSummary) {
        return summaryService.summarize(requestSummary);
    }

}
