package com.cognitum.backend.repository;

import com.cognitum.backend.entity.Flashcard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface FlashcardRepository extends JpaRepository<Flashcard, Long> {

    void deleteAllByNoteId(Long noteId);
    List<Flashcard> findAllByNoteId(Long noteId);

    List<Flashcard> findAllByNoteIdAndIsRetiredFalse(Long noteId);

    @Modifying
    @Query("UPDATE Flashcard f SET f.isStale = true WHERE f.id IN :staleIds")
    void markStaleByIds(List<Long> staleIds);

    @Modifying
    @Query("DELETE FROM Flashcard f WHERE f.id NOT IN :ids")
    void deleteAllExcept(List<Long> ids);

    @Query("SELECT f FROM Flashcard f " +
            "WHERE f.note.userId = :userId " +
            "AND f.nextReview <= :date " +
            "AND f.isRetired = false " +
            "ORDER BY f.nextReview ASC")
    List<Flashcard> findDueCards(@Param("userId") UUID userId, @Param("currentDate") LocalDate currentDate);

}
