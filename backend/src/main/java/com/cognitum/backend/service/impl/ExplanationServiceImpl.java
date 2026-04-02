package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestExplanation;
import com.cognitum.backend.dto.request.RequestMessage;
import com.cognitum.backend.dto.response.ResponseExplanation;
import com.cognitum.backend.properties.NvidiaProperties;
import com.cognitum.backend.service.ExplanationService;
import com.cognitum.backend.web.AIExplanationWebClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ExplanationServiceImpl implements ExplanationService {

    private final AIExplanationWebClient webClient;
    private final NvidiaProperties nvidiaProperties;

    @Override
    public ResponseExplanation requestExplanation(String text) {
        RequestExplanation request = new RequestExplanation();
        request.setModel(nvidiaProperties.getModel());
        request.setMessages(List.of(
                new RequestMessage("system", "You are an expert computer science tutor. Explain concepts clearly and concisely."),
                new RequestMessage("user", "Explain the following concept: " + text)
        ));
        request.setMaxTokens(1024);
        request.setStream(false);

        return webClient.requestExplanation(request);
        }

}
