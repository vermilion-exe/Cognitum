package com.cognitum.backend.web;

import com.cognitum.backend.dto.request.RequestCompletion;
import com.cognitum.backend.dto.response.ResponseCompletion;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

@HttpExchange
public interface NvidiaWebClient {

    @PostExchange("/chat/completions")
    ResponseCompletion requestCompletion(@RequestBody RequestCompletion request);

}
