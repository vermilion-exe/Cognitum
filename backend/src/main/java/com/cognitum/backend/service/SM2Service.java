package com.cognitum.backend.service;

import com.cognitum.backend.dto.response.ResponseSM2;
import com.cognitum.backend.entity.CardReview;
import com.cognitum.backend.entity.Flashcard;

public interface SM2Service {

    ResponseSM2 calculate(Flashcard flashcard, int quality);

}
