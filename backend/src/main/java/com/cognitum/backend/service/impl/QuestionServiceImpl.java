package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestCompletion;
import com.cognitum.backend.dto.request.RequestMessage;
import com.cognitum.backend.dto.response.ResponseCompletion;
import com.cognitum.backend.dto.response.ResponseFlashcard;
import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.entity.Note;
import com.cognitum.backend.properties.NvidiaProperties;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.service.JwtService;
import com.cognitum.backend.service.QuestionService;
import com.cognitum.backend.web.NvidiaWebClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class QuestionServiceImpl implements QuestionService {

    private final NvidiaWebClient webClient;
    private final NvidiaProperties nvidiaProperties;
    private final NoteRepository noteRepository;
    private final JwtService jwtService;

    private ResponseCompletion requestQuestions(Long noteId) {
        RequestCompletion request = new RequestCompletion();
        request.setModel(nvidiaProperties.getModel());

        String systemPrompt = """
            You are a flashcard generation assistant for spaced repetition study.
            When given note content, generate flashcard-style questions and answers.
        
            Rules:
            - Generate 3-7 questions depending on content length
            - Mix question types: factual, conceptual, application
            - Keep answers concise (1-3 sentences)
            - Return ONLY a raw JSON array, no markdown, no explanation
        
            Format:
            [
              {
                "question": "...",
                "answer": "...",
                "type": "factual|conceptual|application"
              }
            ]
            """;

        String userPrompt = "Generate flashcards for the following note:\n\n" + noteRepository.findById(noteId)
                .orElseThrow(() -> new RuntimeException("Note not found with id: " + noteId))
                .getText();

        request.setMessages(List.of(
                new RequestMessage("system", systemPrompt),
                new RequestMessage("user", userPrompt)
        ));
        request.setMaxTokens(1024);
        request.setStream(false);
        ResponseCompletion responseCompletion = webClient.requestCompletion(request);
        System.out.println(responseCompletion);
        return responseCompletion;
    }

    @Override
    public List<ResponseFlashcard> generateFlashcards(String token, Long noteId) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new RuntimeException("Note not found with id: " + noteId));
        ResponseUser user = jwtService.getTokenInfo(token);
        if (!note.getUserId().equals(user.getId())) {
            throw new RuntimeException("Unauthorized access to note with id: " + noteId);
        }

        ResponseCompletion response = requestQuestions(noteId);


        return List.of(); // Replace with actual parsed flashcards
    }

}
