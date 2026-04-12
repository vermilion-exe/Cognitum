package com.cognitum.backend.repository;

import com.cognitum.backend.entity.CardReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CardReviewRepository extends JpaRepository<CardReview, Long> {

    Optional<CardReview> findByFlashcardId(Long flashcardId);

    @Query("SELECT cr FROM CardReview cr " +
            "JOIN FETCH cr.flashcard f " +
            "WHERE cr.flashcard.note.userId = :userId " +
            "AND cr.nextReview <= :date " +
            "AND f.isRetired = false " +
            "ORDER BY cr.nextReview ASC")
    List<CardReview> findDueCards(@Param("userId") UUID userId, @Param("currentDate") LocalDate currentDate);

}
