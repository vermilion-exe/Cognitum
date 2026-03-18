package com.cognitum.backend.controller;

import com.cognitum.backend.dto.request.RequestSummary;
import com.cognitum.backend.dto.response.ResponseSummary;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cognitum/summary")
public class SummaryController {

    @PostMapping("/summarize")
    public ResponseSummary summarize(RequestSummary requestSummary) {

    }

}
