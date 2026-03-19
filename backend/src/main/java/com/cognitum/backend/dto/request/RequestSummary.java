package com.cognitum.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RequestSummary {

    private String markdown;
    @JsonProperty("max_new_tokens")
    private Integer maxNewTokens;
    private Boolean recursive;

}
