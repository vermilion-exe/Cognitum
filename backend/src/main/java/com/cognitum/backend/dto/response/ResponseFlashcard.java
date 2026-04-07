package com.cognitum.backend.dto.response;

import com.cognitum.backend.enums.FlashcardType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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
    @JsonProperty("created_at")
    private LocalDateTime createdAt;

}
