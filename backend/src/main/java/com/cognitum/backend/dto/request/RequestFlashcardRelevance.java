package com.cognitum.backend.dto.request;

import com.cognitum.backend.dto.response.ResponseFlashcard;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RequestFlashcardRelevance {

    private String markdown;
    private List<ResponseFlashcard> flashcards;

}
