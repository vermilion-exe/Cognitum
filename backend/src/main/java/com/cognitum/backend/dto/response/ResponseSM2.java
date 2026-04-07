package com.cognitum.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class ResponseSM2 {

    private Double easinessFactor;
    private Integer interval;
    private Integer repetitions;
    private LocalDate nextReview;

}
