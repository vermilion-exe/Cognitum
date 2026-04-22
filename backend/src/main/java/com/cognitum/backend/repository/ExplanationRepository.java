package com.cognitum.backend.repository;

import com.cognitum.backend.entity.Explanation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ExplanationRepository extends JpaRepository<Explanation, UUID> {

    List<Explanation> findAllByNoteId(Long noteId);

}
