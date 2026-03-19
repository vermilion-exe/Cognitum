package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestSummary;
import com.cognitum.backend.dto.response.ResponseSummary;
import com.cognitum.backend.service.SummaryService;
import com.cognitum.backend.web.AISummaryWebClient;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class SummaryServiceImpl implements SummaryService {

    private final AISummaryWebClient aiSummaryWebClient;
    private static final Logger log = LoggerFactory.getLogger(SummaryServiceImpl.class);
    private final ObjectMapper objectMapper;

    @Override
    public ResponseSummary summarize(RequestSummary requestSummary) {
        try {
            log.info("Sending to AI: {}", objectMapper.writeValueAsString(requestSummary));
        } catch (Exception e) {
            log.error("Failed to serialize request", e);
        }

        return aiSummaryWebClient.summarize(requestSummary);
    }

}
