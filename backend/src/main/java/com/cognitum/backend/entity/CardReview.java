package com.cognitum.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Getter
@Setter
@Table(name = "CardReview", schema = "cognitum_data")
public class CardReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

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
    private LocalDateTime lastReviewed;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flashcard_id")
    private Flashcard flashcard;

}
