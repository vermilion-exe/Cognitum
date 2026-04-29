package com.cognitum.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Table(name = "Attachment", schema = "cognitum_data")
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String path;

    @Column(name = "content_type")
    private String contentType;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "last_updated")
    private OffsetDateTime lastUpdated;

    @Lob
    @Column(columnDefinition = "bytea")
    private byte[] bytes;

}
