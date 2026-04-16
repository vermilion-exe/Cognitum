package com.cognitum.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Table(name = "Explanation", schema = "cognitum_data")
public class Explanation {

    @Id
//    @GeneratedValue(generator = "uuid2")
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "from_pos")
    private Integer from;

    @Column(name = "to_pos")
    private Integer to;

    @Column(name = "selected_text")
    private String selectedText;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "note_id")
    private Note note;

}
