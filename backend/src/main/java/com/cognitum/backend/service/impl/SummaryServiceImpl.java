package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestSummary;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.dto.response.ResponseSummary;
import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.entity.Summary;
import com.cognitum.backend.entity.User;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.repository.SummaryRepository;
import com.cognitum.backend.repository.TokenRepository;
import com.cognitum.backend.repository.UserRepository;
import com.cognitum.backend.service.JwtService;
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
    private final JwtService jwtService;
    private final SummaryRepository summaryRepository;
    private final NoteRepository noteRepository;

    @Override
    public ResponseSummary summarize(RequestSummary requestSummary) {
        return webClient.summarize(requestSummary);
    }

    @Override
    public ResponseSummary getSummaryByNoteId(String token, Long noteId) {
        Summary summary = summaryRepository.getSummaryByNoteId(noteId)
                .orElseThrow(() -> new RuntimeException("Summary not found"));
        ResponseUser user = jwtService.getTokenInfo(token);

        if (!summary.getNote().getUserId().equals(user.getId()))
            throw new RuntimeException("Unauthorized access to summary");

        return new ResponseSummary(summary.getId(), summary.getSummary(), summary.getNote().getId());
    }

    @Override
    public ResponseOperation createSummary(String token, ResponseSummary request) {
        ResponseUser user = jwtService.getTokenInfo(token);

        summaryRepository.getSummaryByNoteId(request.getNoteId())
                .ifPresent(s -> {
                    if (!s.getNote().getUserId().equals(user.getId()))
                        throw new RuntimeException("Unauthorized modification to summary");
                });

        Summary summary = new Summary();
        summary.setId(request.getId());
        summary.setSummary(request.getSummary());
        summary.setNote(noteRepository.findById(request.getNoteId())
                .orElseThrow(() -> new RuntimeException("Note not found")));

        summaryRepository.save(summary);

        return new ResponseOperation(true);
    }

}
