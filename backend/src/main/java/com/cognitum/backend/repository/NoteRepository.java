package com.cognitum.backend.repository;

import com.cognitum.backend.entity.Note;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NoteRepository extends JpaRepository<Note, Long> {

    List<Note> findAllByUserId(UUID userId);
    Optional<Note> findByUserIdAndPath(UUID userId, String path);

}
