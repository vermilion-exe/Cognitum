package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestCompletion;
import com.cognitum.backend.dto.request.RequestHighlight;
import com.cognitum.backend.dto.request.RequestMessage;
import com.cognitum.backend.dto.response.ResponseCompletion;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.entity.Explanation;
import com.cognitum.backend.entity.Note;
import com.cognitum.backend.exception.NotFoundException;
import com.cognitum.backend.exception.UnauthorizedException;
import com.cognitum.backend.properties.NvidiaProperties;
import com.cognitum.backend.repository.ExplanationRepository;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.service.ExplanationService;
import com.cognitum.backend.service.JwtService;
import com.cognitum.backend.web.NvidiaWebClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ExplanationServiceImpl implements ExplanationService {

    private final NvidiaWebClient webClient;
    private final NvidiaProperties nvidiaProperties;
    private final NoteRepository noteRepository;
    private final ExplanationRepository explanationRepository;
    private final JwtService jwtService;

    @Override
    public ResponseCompletion requestExplanation(String text) {
        RequestCompletion request = new RequestCompletion();
        request.setModel(nvidiaProperties.getModel());
        request.setMessages(List.of(
                new RequestMessage("system", "You are an expert computer science tutor. Explain concepts clearly and concisely. The explanation should be no longer than 200 words and in LaTeX format when appropriate."),
                new RequestMessage("user", "Explain the following concept: " + text)
        ));
        request.setMaxTokens(1024);
        request.setStream(false);

        return webClient.requestCompletion(request);
    }

    @Override
    public RequestHighlight createExplanation(String token, RequestHighlight request) {
        ResponseUser user = jwtService.getTokenInfo(token);
        Note note = noteRepository.findById(request.getNoteId())
                .orElseThrow(() -> new RuntimeException("Note not found with id: " + request.getNoteId()));
        if(!note.getUserId().equals(user.getId())) {
            throw new UnauthorizedException("Unauthorized to update explanation with id: " + request.getId());
        }

        Explanation explanation = new Explanation();

        explanation.setId(request.getId());
        explanation.setSelectedText(request.getSelectedText());
        explanation.setExplanation(request.getExplanation());
        explanation.setFrom(request.getFrom());
        explanation.setTo(request.getTo());
        explanation.setCreatedAt(request.getCreatedAt());
        explanation.setNote(note);

        Explanation savedExplanation = explanationRepository.save(explanation);

        RequestHighlight requestHighlight = new RequestHighlight();
        requestHighlight.setId(savedExplanation.getId());
        requestHighlight.setSelectedText(savedExplanation.getSelectedText());
        requestHighlight.setExplanation(savedExplanation.getExplanation());
        requestHighlight.setFrom(savedExplanation.getFrom());
        requestHighlight.setTo(savedExplanation.getTo());
        requestHighlight.setCreatedAt(savedExplanation.getCreatedAt());
        requestHighlight.setNoteId(savedExplanation.getNote().getId());

        return requestHighlight;
    }

    @Override
    public RequestHighlight getExplanationById(String token, UUID id) {
        Explanation explanation = explanationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Explanation not found with id: " + id));

        ResponseUser user = jwtService.getTokenInfo(token);
        if(!explanation.getNote().getUserId().equals(user.getId()) ) {
            throw new UnauthorizedException("Unauthorized to access explanation with id: " + id);
        }

        RequestHighlight requestHighlight = new RequestHighlight();
        requestHighlight.setId(explanation.getId());
        requestHighlight.setSelectedText(explanation.getSelectedText());
        requestHighlight.setFrom(explanation.getFrom());
        requestHighlight.setTo(explanation.getTo());
        requestHighlight.setCreatedAt(explanation.getCreatedAt());
        requestHighlight.setNoteId(explanation.getNote().getId());

        return requestHighlight;
    }

    @Override
    public List<RequestHighlight> getExplanationsByNoteId(String token, Long noteId) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new NotFoundException("Note not found with id: " + noteId));

        ResponseUser user = jwtService.getTokenInfo(token);
        if(!note.getUserId().equals(user.getId()) ) {
            throw new UnauthorizedException("Unauthorized to access explanations for note with id: " + noteId);
        }

        return note.getExplanations().stream().map(explanation -> {
            RequestHighlight requestHighlight = new RequestHighlight();
            requestHighlight.setId(explanation.getId());
            requestHighlight.setSelectedText(explanation.getSelectedText());
            requestHighlight.setFrom(explanation.getFrom());
            requestHighlight.setTo(explanation.getTo());
            requestHighlight.setCreatedAt(explanation.getCreatedAt());
            requestHighlight.setNoteId(explanation.getNote().getId());
            return requestHighlight;
        }).toList();
    }

    @Override
    public ResponseOperation deleteExplanation(String token, UUID id) {
        Explanation explanation = explanationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Explanation not found with id: " + id));

        ResponseUser user = jwtService.getTokenInfo(token);
        if(!explanation.getNote().getUserId().equals(user.getId()) ) {
            throw new UnauthorizedException("Unauthorized to delete explanation with id: " + id);
        }

        explanationRepository.delete(explanation);

        return new ResponseOperation(true);
    }

}
