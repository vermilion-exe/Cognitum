package com.cognitum.backend.service;

import com.cognitum.backend.dto.response.ResponseFlashcard;
import com.cognitum.backend.dto.response.ResponseOperation;

import java.util.List;
import java.util.UUID;

public interface QuestionService {

    List<ResponseFlashcard> generateFlashcards(String markdown, Integer count);
    ResponseOperation updateStaleFlashcards(String token, Long noteId, List<UUID> flashcardIds);
    List<UUID> checkFlashcardRelevance(String markdown, List<ResponseFlashcard> flashcards);
    List<ResponseFlashcard> getDueCards(String token);
    ResponseOperation createFlashcards(String token, List<ResponseFlashcard> request);
    ResponseOperation submitReview(String token, ResponseFlashcard review);
    List<ResponseFlashcard> getFlashcardsByNoteId(String token, Long noteId);
    ResponseOperation deleteStaleFlashcards(String token, Long noteId);
    ResponseOperation deleteAllFlashcardsByNoteId(String token, Long noteId);
    ResponseOperation deleteFlashcardsExcept(String token, List<UUID> flashcardIds);
    ResponseOperation deleteFlashcard(String token, UUID flashcardId);

}
