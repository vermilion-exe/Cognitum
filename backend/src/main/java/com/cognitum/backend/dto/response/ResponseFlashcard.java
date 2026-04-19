package com.cognitum.backend.dto.response;

import com.cognitum.backend.enums.FlashcardType;
import com.fasterxml.jackson.annotation.JsonProperty;
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
public class ResponseFlashcard {

    private Long id;
    private String question;
    private String answer;
    private FlashcardType type;
    @JsonProperty("is_retired")
    private Boolean isRetired;
    @JsonProperty("is_stale")
    private Boolean isStale;
    @JsonProperty("easiness_factor")
    private Double easinessFactor;
    private Integer interval;
    private Integer repetitions;
    @JsonProperty("next_review")
    private LocalDate nextReview;
    @JsonProperty("last_reviewed")
    private LocalDateTime lastReviewed;
    @JsonProperty("note_id")
    private Long noteId;

}
