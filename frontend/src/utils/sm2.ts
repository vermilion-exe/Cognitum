import { ResponseFlashcard } from "../types/ResponseFlashcard";

export function calculate(state: ResponseFlashcard, quality: number): ResponseFlashcard {
    if (quality < 0 || quality > 5) throw new Error("Quality must be 0-5");

    let { easiness_factor: ef, interval, repetitions } = state;

    if (quality >= 3) {
        interval =
            repetitions === 0 ? 1
                : repetitions === 1 ? 6
                    : Math.round(interval * ef);
        repetitions++;
    } else {
        repetitions = 0;
        interval = 1;
    }

    const is_retired = ef >= 2.8 && interval >= 21;

    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    ef = Math.max(1.3, ef);

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    return {
        ...state,
        easiness_factor: ef,
        interval,
        repetitions,
        is_retired: is_retired,
        last_reviewed: new Date().toISOString(),
        next_review: nextReview.toISOString().split("T")[0],
    };
}
