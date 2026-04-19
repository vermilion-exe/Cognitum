package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.response.ResponseSM2;
import com.cognitum.backend.entity.Flashcard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SM2ServiceImplTest {

    private SM2ServiceImpl sm2Service;

    @BeforeEach
    void setUp() {
        sm2Service = new SM2ServiceImpl();
    }

    @Test
    void calculate_withPoorQuality_resetsInterval() {
        Flashcard flashcard = createFlashcard(2.5, 10, 3);

        ResponseSM2 result = sm2Service.calculate(flashcard, 2);

        assertNotNull(result);
        assertEquals(1, result.getInterval());
        assertEquals(0, result.getRepetitions());
        assertTrue(result.getEasinessFactor() < 2.5);
    }

    @Test
    void calculate_withExcellentQuality_improvesMetrics() {
        Flashcard flashcard = createFlashcard(2.5, 10, 3);

        ResponseSM2 result = sm2Service.calculate(flashcard, 5);

        assertNotNull(result);
        assertTrue(result.getEasinessFactor() > 2.5);
        assertTrue(result.getInterval() > 10);
        assertEquals(4, result.getRepetitions());
    }

    @Test
    void calculate_withGoodQuality_updatesMetrics() {
        Flashcard flashcard = createFlashcard(2.5, 10, 3);

        ResponseSM2 result = sm2Service.calculate(flashcard, 4);

        assertNotNull(result);
        assertTrue(result.getEasinessFactor() >= 1.3);
        assertEquals(4, result.getRepetitions());
    }

    @Test
    void calculate_withMinimumQuality_three() {
        Flashcard flashcard = createFlashcard(2.5, 10, 0);

        ResponseSM2 result = sm2Service.calculate(flashcard, 3);

        assertNotNull(result);
        assertEquals(1, result.getRepetitions());
        assertTrue(result.getInterval() > 0);
    }

    @Test
    void calculate_withZeroRepetitions_setsIntervalToOne() {
        Flashcard flashcard = createFlashcard(2.5, 10, 0);

        ResponseSM2 result = sm2Service.calculate(flashcard, 5);

        assertNotNull(result);
        assertEquals(1, result.getInterval());
    }

    @Test
    void calculate_withOneRepetition_setsIntervalToSix() {
        Flashcard flashcard = createFlashcard(2.5, 10, 1);

        ResponseSM2 result = sm2Service.calculate(flashcard, 5);

        assertNotNull(result);
        assertEquals(6, result.getInterval());
    }

    @Test
    void calculate_withMultipleRepetitions_appliesEasinessMultiplier() {
        Flashcard flashcard = createFlashcard(2.5, 10, 5);

        ResponseSM2 result = sm2Service.calculate(flashcard, 5);

        assertNotNull(result);
        assertTrue(result.getInterval() > 10);
    }

    @Test
    void calculate_withLowQuality_decreasesEasiness() {
        Flashcard flashcard = createFlashcard(2.5, 10, 3);

        ResponseSM2 result = sm2Service.calculate(flashcard, 1);

        assertNotNull(result);
        assertTrue(result.getEasinessFactor() < 2.5);
    }

    @Test
    void calculate_withHighQuality_increasesEasiness() {
        Flashcard flashcard = createFlashcard(2.5, 10, 3);

        ResponseSM2 result = sm2Service.calculate(flashcard, 5);

        assertNotNull(result);
        assertTrue(result.getEasinessFactor() > 2.5);
    }

    @Test
    void calculate_easinessNeverBelowMinimum() {
        Flashcard flashcard = createFlashcard(1.5, 10, 3);

        ResponseSM2 result = sm2Service.calculate(flashcard, 1);

        assertNotNull(result);
        assertTrue(result.getEasinessFactor() >= 1.3);
    }

    @Test
    void calculate_nextReviewDate_isInFuture() {
        Flashcard flashcard = createFlashcard(2.5, 10, 3);

        ResponseSM2 result = sm2Service.calculate(flashcard, 5);

        assertNotNull(result);
        assertTrue(result.getNextReview().isAfter(java.time.LocalDate.now().minusDays(1)));
    }

    private Flashcard createFlashcard(double easiness, int interval, int repetitions) {
        Flashcard flashcard = new Flashcard();
        flashcard.setEasinessFactor(easiness);
        flashcard.setInterval(interval);
        flashcard.setRepetitions(repetitions);
        return flashcard;
    }
}