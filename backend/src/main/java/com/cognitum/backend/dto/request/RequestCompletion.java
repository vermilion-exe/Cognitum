package com.cognitum.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RequestCompletion {

    private String model;
    private List<RequestMessage> messages;
    @JsonProperty("max_tokens")
    private Integer maxTokens;
    private Boolean stream;

}
