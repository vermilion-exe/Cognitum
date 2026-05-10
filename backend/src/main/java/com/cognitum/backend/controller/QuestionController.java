package com.cognitum.backend.controller;

import com.cognitum.backend.dto.request.RequestFlashcardGeneration;
import com.cognitum.backend.dto.request.RequestFlashcardRelevance;
import com.cognitum.backend.dto.response.ResponseFlashcard;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.service.QuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/cognitum/question")
public class QuestionController {

    private final QuestionService questionService;

    @PostMapping("/flashcards/generate")
    public List<ResponseFlashcard> generateFlashcards(@RequestHeader("Authorization") String token,
                                                      @RequestBody RequestFlashcardGeneration request) {
        return questionService.generateFlashcards(request.getMarkdown(), request.getCount());
    }

    @PutMapping("/flashcards/stale")
    public ResponseOperation updateStaleFlashcards(@RequestHeader("Authorization") String token, @RequestParam Long noteId, @RequestBody List<UUID> flashcardIds) {
        return questionService.updateStaleFlashcards(token, noteId, flashcardIds);
    }

    @PostMapping("/relevance")
    public List<UUID> checkFlashcardRelevance(@RequestHeader("Authorization") String token,
                                              @RequestBody RequestFlashcardRelevance request) {
        return questionService.checkFlashcardRelevance(request.getMarkdown(), request.getFlashcards());
    }

    @GetMapping("/due")
    public List<ResponseFlashcard> getDueCards(@RequestHeader("Authorization") String token) {
        return questionService.getDueCards(token);
    }

    @PostMapping
    public ResponseOperation createFlashcards(@RequestHeader("Authorization") String token, @RequestBody List<ResponseFlashcard> request) {
        return questionService.createFlashcards(token, request);
    }

    @PostMapping("/review")
    public ResponseOperation submitReview(@RequestHeader("Authorization") String token, @RequestBody ResponseFlashcard review) {
        return questionService.submitReview(token, review);
    }

    @GetMapping("/flashcards")
    public List<ResponseFlashcard> getFlashcardsByNoteId(@RequestHeader("Authorization") String token, @RequestParam Long noteId) {
        return questionService.getFlashcardsByNoteId(token, noteId);
    }

    @DeleteMapping("/flashcards/stale")
    public ResponseOperation deleteStaleFlashcards(@RequestHeader("Authorization") String token, @RequestParam Long noteId) {
        return questionService.deleteStaleFlashcards(token, noteId);
    }

    @DeleteMapping("/flashcards")
    public ResponseOperation deleteAllFlashcardsByNoteId(@RequestHeader("Authorization") String token, @RequestParam Long noteId) {
        return questionService.deleteAllFlashcardsByNoteId(token, noteId);
    }

    @DeleteMapping("/flashcards/except")
    public ResponseOperation deleteFlashcardsExcept(@RequestHeader("Authorization") String token, @RequestParam List<UUID> flashcardIds) {
        return questionService.deleteFlashcardsExcept(token, flashcardIds);
    }

    @DeleteMapping("/flashcards/{id}")
    public ResponseOperation deleteFlashcard(@RequestHeader("Authorization") String token, @PathVariable("id") UUID flashcardId) {
        return questionService.deleteFlashcard(token, flashcardId);
    }

}
