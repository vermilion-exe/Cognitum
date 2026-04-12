package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.response.ResponseSM2;
import com.cognitum.backend.entity.CardReview;
import com.cognitum.backend.entity.Flashcard;
import com.cognitum.backend.service.SM2Service;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
public class SM2ServiceImpl implements SM2Service {

    @Override
    public ResponseSM2 calculate(Flashcard flashcard, int quality) {
        double easiness = flashcard.getEasinessFactor();
        int interval = flashcard.getInterval();
        int repetitions = flashcard.getRepetitions();

        if (quality < 3) {
            return new ResponseSM2(
                    Math.max(1.3, easiness - 0.2),
                    1,
                    0,
                    LocalDate.now().plusDays(1)
            );
        }

        double newEasiness = easiness
                + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        newEasiness = Math.max(1.3, newEasiness);

        int newInterval = switch (repetitions) {
            case 0 -> 1;
            case 1 -> 6;
            default -> (int) Math.round(interval * easiness);
        };

        return new ResponseSM2(
                newEasiness,
                newInterval,
                repetitions + 1,
                LocalDate.now().plusDays(newInterval)
        );
    }

}
