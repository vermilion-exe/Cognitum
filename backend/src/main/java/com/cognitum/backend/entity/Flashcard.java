package com.cognitum.backend.entity;

import com.cognitum.backend.enums.FlashcardType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Getter
@Setter
@Table(name = "Flashcard", schema = "cognitum_data")
public class Flashcard {

    @Id
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    @Column(columnDefinition = "TEXT")
    private String question;

    @Column(columnDefinition = "TEXT")
    private String answer;

    @Enumerated(EnumType.STRING)
    @Column
    private FlashcardType type;

    @Column(name = "is_retired")
    @Builder.Default
    private Boolean isRetired = false;

    @Column(name= "is_stale")
    @Builder.Default
    private Boolean isStale = false;

    @Column(name = "easiness_factor")
    @Builder.Default
    private Double easinessFactor = 2.5;

    @Column(name = "review_interval")
    @Builder.Default
    private Integer interval = 1; // in days

    @Column
    @Builder.Default
    private Integer repetitions = 0;

    @Column(name = "next_review")
    @Builder.Default
    private LocalDate nextReview = LocalDate.now();

    @Column(name = "last_reviewed")
    private OffsetDateTime lastReviewed;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "note_id")
    private Note note;

}
