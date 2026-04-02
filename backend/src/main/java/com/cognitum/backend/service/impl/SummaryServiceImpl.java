package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestSummary;
import com.cognitum.backend.dto.response.ResponseSummary;
import com.cognitum.backend.entity.User;
import com.cognitum.backend.repository.TokenRepository;
import com.cognitum.backend.repository.UserRepository;
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

    private final AISummaryWebClient webClient;

    @Override
    public ResponseSummary summarize(RequestSummary requestSummary) {
        return webClient.summarize(requestSummary);
    }

}
