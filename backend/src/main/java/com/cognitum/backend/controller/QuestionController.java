package com.cognitum.backend.controller;

import com.cognitum.backend.dto.response.ResponseCardReview;
import com.cognitum.backend.dto.response.ResponseFlashcard;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.service.QuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/cognitum/question")
public class QuestionController {

    private final QuestionService questionService;

    @PostMapping("/flashcards")
    public List<ResponseFlashcard> generateFlashcards(@RequestHeader("Authorization") String token, @RequestParam Long noteId, @RequestParam Integer count) {
        return questionService.generateFlashcards(token, noteId, count);
    }

    @PutMapping("/flashcards/stale")
    public ResponseOperation updateStaleFlashcards(@RequestHeader("Authorization") String token, @RequestParam Long noteId, @RequestBody List<Long> flashcardIds) {
        return questionService.updateStaleFlashcards(token, noteId, flashcardIds);
    }

    @GetMapping("/relevance")
    public List<Long> checkFlashcardRelevance(@RequestHeader("Authorization") String token, @RequestParam Long noteId) {
        return questionService.checkFlashcardRelevance(token, noteId);
    }

    @GetMapping("/due")
    public List<ResponseFlashcard> getDueCards(@RequestHeader("Authorization") String token) {
        return questionService.getDueCards(token);
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

    @DeleteMapping("/flashcards/{id}")
    public ResponseOperation deleteFlashcard(@RequestHeader("Authorization") String token, @PathVariable("id") Long flashcardId) {
        return questionService.deleteFlashcard(token, flashcardId);
    }

}
