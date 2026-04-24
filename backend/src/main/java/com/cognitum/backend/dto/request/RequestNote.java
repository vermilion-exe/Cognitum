package com.cognitum.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RequestNote {

    private Long id;
    private String text;
    private String path;
    @JsonProperty("created_at")
    private OffsetDateTime createdAt;
    @JsonProperty("last_updated")
    private OffsetDateTime lastUpdated;

}
