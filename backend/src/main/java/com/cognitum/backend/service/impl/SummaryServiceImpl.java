package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestSummary;
import com.cognitum.backend.dto.response.ResponseSummary;
import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.entity.Note;
import com.cognitum.backend.entity.Summary;
import com.cognitum.backend.exception.NotFoundException;
import com.cognitum.backend.exception.UnauthorizedException;
import com.cognitum.backend.properties.ApplicationProperties;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.repository.SummaryRepository;
import com.cognitum.backend.service.JwtService;
import com.cognitum.backend.service.NoteService;
import com.cognitum.backend.service.SummaryService;
import com.cognitum.backend.web.AISummaryWebClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SummaryServiceImpl implements SummaryService {

    private final AISummaryWebClient webClient;
    private final JwtService jwtService;
    private final SummaryRepository summaryRepository;
    private final NoteRepository noteRepository;
    private final NoteService noteService;
    private final ApplicationProperties applicationProperties;

    @Override
    public ResponseSummary summarize(RequestSummary requestSummary) {
        if (isTestMode()) {
            String markdown = requestSummary == null || requestSummary.getMarkdown() == null
                    ? "the provided note"
                    : requestSummary.getMarkdown();
            return new ResponseSummary(null, "Template summary for: " + markdown, null);
        }

        // Forward summarization requests to the AI summary client
        return webClient.summarize(requestSummary);
    }

    private boolean isTestMode() {
        return applicationProperties != null && Boolean.TRUE.equals(applicationProperties.getIsTestMode());
    }

    @Override
    public ResponseSummary getSummaryByNoteId(String token, Long noteId) {
        // Summary access is checked through the parent note
        Summary summary = summaryRepository.getSummaryByNoteId(noteId)
                .orElseThrow(() -> new NotFoundException("Summary not found"));
        ResponseUser user = jwtService.getTokenInfo(token);

        if (!summary.getNote().getUserId().equals(user.getId()))
            throw new UnauthorizedException("Unauthorized access to summary");

        return new ResponseSummary(summary.getId(), summary.getSummary(), summary.getNote().getId());
    }

    @Override
    public ResponseSummary createSummary(String token, ResponseSummary request) {
        ResponseUser user = jwtService.getTokenInfo(token);

        // Existing summaries can only be replaced by the owner
        summaryRepository.getSummaryByNoteId(request.getNoteId())
                .ifPresent(s -> {
                    if (!s.getNote().getUserId().equals(user.getId()))
                        throw new UnauthorizedException("Unauthorized modification to summary");
                });

        Note note = noteRepository.findById(request.getNoteId())
                .orElseThrow(() -> new NotFoundException("Note not found"));

        // Save the summary against the requested note
        Summary summary = new Summary();
        summary.setId(request.getId());
        summary.setSummary(request.getSummary());
        summary.setNote(note);

        summaryRepository.save(summary);

        noteService.updateNoteTimestamp(note);

        return new ResponseSummary(summary.getId(), summary.getSummary(), summary.getNote().getId());
    }

}
