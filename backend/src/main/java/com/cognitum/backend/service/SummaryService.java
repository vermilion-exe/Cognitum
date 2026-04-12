package com.cognitum.backend.service;

import com.cognitum.backend.dto.request.RequestSummary;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.dto.response.ResponseSummary;

public interface SummaryService {

    ResponseSummary summarize(RequestSummary requestSummary);
    ResponseSummary getSummaryByNoteId(String token, Long noteId);
    ResponseOperation createSummary(String token, ResponseSummary request);

}
