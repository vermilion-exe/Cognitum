package com.cognitum.backend.web;

import com.cognitum.backend.dto.request.RequestExplanation;
import com.cognitum.backend.dto.response.ResponseExplanation;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

@HttpExchange
public interface AIExplanationWebClient {

    @PostExchange("/chat/completions")
    ResponseExplanation requestExplanation(@RequestBody RequestExplanation request);

}
