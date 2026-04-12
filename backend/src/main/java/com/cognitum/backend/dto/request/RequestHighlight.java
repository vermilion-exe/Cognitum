package com.cognitum.backend.dto.request;

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
    private String selectedText;
    private Integer from;
    private Integer to;
    private LocalDateTime createdAt;
    private Long noteId;

}
