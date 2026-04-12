package com.cognitum.backend.enums;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum FlashcardType {
    FACTUAL, CONCEPTUAL, APPLICATION;

    @JsonCreator
    public static FlashcardType fromString(String value) {
        return FlashcardType.valueOf(value.toUpperCase());
    }
}
