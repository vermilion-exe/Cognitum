package com.cognitum.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@Builder
@Getter
@Setter
public class ResponseAuthentication {

    @JsonProperty("access_token")
    private String accessToken;
    @JsonProperty("refresh_token")
    private String refreshToken;
    @JsonProperty("structure_id")
    private Long structureId;
    @JsonProperty("user_id")
    private UUID userId;

}
