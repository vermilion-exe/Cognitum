package com.cognitum.backend.service;

import com.cognitum.backend.dto.response.ResponseFlashcard;
import com.cognitum.backend.dto.response.ResponseOperation;

import java.util.List;

public interface QuestionService {

    List<ResponseFlashcard> generateFlashcards(String token, Long noteId, Integer count);
    ResponseOperation updateStaleFlashcards(String token, Long noteId, List<Long> flashcardIds);
    List<Long> checkFlashcardRelevance(String token, Long noteId);
    List<ResponseFlashcard> getDueCards(String token);
    ResponseOperation createFlashcard(String token, ResponseFlashcard request);
    ResponseOperation submitReview(String token, ResponseFlashcard review);
    List<ResponseFlashcard> getFlashcardsByNoteId(String token, Long noteId);
    ResponseOperation deleteStaleFlashcards(String token, Long noteId);
    ResponseOperation deleteAllFlashcardsByNoteId(String token, Long noteId);
    ResponseOperation deleteFlashcardsExcept(String token, List<Long> flashcardIds);
    ResponseOperation deleteFlashcard(String token, Long flashcardId);

}
