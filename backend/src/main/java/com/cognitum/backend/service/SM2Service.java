package com.cognitum.backend.service;

import com.cognitum.backend.dto.response.ResponseSM2;
import com.cognitum.backend.entity.CardReview;

public interface SM2Service {

    ResponseSM2 calculate(CardReview review, int quality);

}
