package com.cognitum.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class ResponseSummary {

    private UUID id;
    private String summary;
    @JsonProperty("note_id")
    private Long noteId;

}
