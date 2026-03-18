package com.cognitum.backend.web;

import com.cognitum.backend.dto.request.RequestSummary;
import com.cognitum.backend.dto.response.ResponseSummary;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

@HttpExchange("/summarize")
public interface AISummaryWebClient {

    @PostExchange
    ResponseSummary summarize(@RequestBody RequestSummary request);

}
