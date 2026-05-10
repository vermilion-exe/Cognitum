package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestCompletion;
import com.cognitum.backend.dto.request.RequestMessage;
import com.cognitum.backend.dto.request.RequestSummary;
import com.cognitum.backend.dto.response.ResponseSummary;
import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.entity.Note;
import com.cognitum.backend.entity.Summary;
import com.cognitum.backend.exception.NotFoundException;
import com.cognitum.backend.exception.UnauthorizedException;
import com.cognitum.backend.properties.ApplicationProperties;
import com.cognitum.backend.properties.NvidiaProperties;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.repository.SummaryRepository;
import com.cognitum.backend.service.JwtService;
import com.cognitum.backend.service.NoteService;
import com.cognitum.backend.service.SummaryService;
import com.cognitum.backend.web.NvidiaWebClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SummaryServiceImpl implements SummaryService {

    private final NvidiaWebClient webClient;
    private final JwtService jwtService;
    private final SummaryRepository summaryRepository;
    private final NoteRepository noteRepository;
    private final NoteService noteService;
    private final ApplicationProperties applicationProperties;
    private final NvidiaProperties nvidiaProperties;

    @Override
    public ResponseSummary summarize(RequestSummary requestSummary) {
        if (isTestMode()) {
            String markdown = requestSummary == null || requestSummary.getMarkdown() == null
                    ? "the provided note"
                    : requestSummary.getMarkdown();
            return new ResponseSummary(null, "Template summary for: " + markdown, null);
        }

        // Forward summarization requests to the AI summary client
        RequestCompletion request = new RequestCompletion();
        request.setModel(nvidiaProperties.getModel());

        String systemPrompt = """
            You are a summary generation assistant for student notes.
            When given note content, generate a detailed summary of the given note.
        
            Rules:
            - Keep summary simple and understandable, but include all important details.
            - Assume no prior knowledge of the note content, but use the note's language and terminology.
            - The summary should be in markdown format, but the response should be a JSON object with a single "summary" field containing the markdown summary.
        
            Ensure that the response is in this EXACT format:
            {
              "summary": "Markdown summary of the note content goes here"
            }
            """;

        String userPrompt = "Generate summary for the following note:\n\n" + requestSummary.getMarkdown();

        request.setMessages(List.of(
                new RequestMessage("system", systemPrompt),
                new RequestMessage("user", userPrompt)
        ));
        request.setMaxTokens(requestSummary.getMaxNewTokens());
        request.setStream(false);
        String completionContent = webClient.requestCompletion(request).getChoices().get(0).getMessage().getContent();

        String summaryText = extractSummaryFromCompletion(completionContent);
        return new ResponseSummary(null, summaryText, null);
    }

    private String extractSummaryFromCompletion(String completionContent) {
        // The completion content should be a JSON object with a "summary" field
        try {
            int summaryStart = completionContent.indexOf("\"summary\":");
            if (summaryStart == -1) throw new IllegalArgumentException("Missing 'summary' field");

            int quoteStart = completionContent.indexOf("\"", summaryStart + 10);
            int quoteEnd = completionContent.indexOf("\"", quoteStart + 1);
            if (quoteStart == -1 || quoteEnd == -1) throw new IllegalArgumentException("Malformed 'summary' value");

            return completionContent.substring(quoteStart + 1, quoteEnd);
        } catch (Exception e) {
            throw new RuntimeException("Failed to extract summary from AI response: " + e.getMessage());
        }
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
