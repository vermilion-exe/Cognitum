package com.cognitum.backend.dto.response;

import com.cognitum.backend.enums.FlashcardType;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class ResponseCardReview {

    private Long reviewId;
    private Long flashcardId;
    private String question;
    private String answer;
    private FlashcardType type;
    private Double easinessFactor;
    private Integer interval;
    private Integer repetitions;
    private LocalDate nextReview;
    private LocalDateTime lastReviewed;

}
