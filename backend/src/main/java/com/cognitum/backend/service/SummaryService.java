package com.cognitum.backend.service;

import com.cognitum.backend.dto.request.RequestSummary;
import com.cognitum.backend.dto.response.ResponseSummary;

public interface SummaryService {

    ResponseSummary summarize(RequestSummary requestSummary);

}
