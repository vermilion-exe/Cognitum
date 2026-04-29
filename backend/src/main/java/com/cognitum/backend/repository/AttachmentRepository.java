package com.cognitum.backend.repository;

import com.cognitum.backend.entity.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    Optional<Attachment> findByPathAndUserId(String path, UUID userId);

    List<Attachment> findByUserId(UUID userId);
}
