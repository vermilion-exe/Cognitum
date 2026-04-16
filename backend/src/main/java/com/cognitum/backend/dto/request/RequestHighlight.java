package com.cognitum.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RequestHighlight {

    private UUID id;
    @JsonProperty("selected_text")
    private String selectedText;
    private String explanation;
    private Integer from;
    private Integer to;
    @JsonProperty("created_at")
    private LocalDateTime createdAt;
    @JsonProperty("note_id")
    private Long noteId;

}
