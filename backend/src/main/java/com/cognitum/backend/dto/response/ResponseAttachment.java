package com.cognitum.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class ResponseAttachment {

    private Long id;
    private String path;
    @JsonProperty("content_type")
    private String contentType;
    @JsonProperty("created_at")
    private OffsetDateTime createdAt;
    @JsonProperty("last_updated")
    private OffsetDateTime lastUpdated;
    private byte[] bytes;

}
