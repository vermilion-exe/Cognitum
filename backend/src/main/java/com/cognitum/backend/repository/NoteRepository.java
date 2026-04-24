package com.cognitum.backend.repository;

import com.cognitum.backend.entity.Note;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NoteRepository extends JpaRepository<Note, Long> {

    List<Note> findAllByUserId(UUID userId);
    Optional<Note> findByUserIdAndPath(UUID userId, String path);
    @Query("SELECT n FROM Note n WHERE n.userId = :userId AND n.lastUpdated > :timestamp")
    List<Note> findAllByUserIdAndLastUpdatedAfter(UUID userId, OffsetDateTime timestamp);

}
