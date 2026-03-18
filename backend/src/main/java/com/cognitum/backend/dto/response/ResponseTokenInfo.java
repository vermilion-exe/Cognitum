package com.cognitum.backend.dto.response;

import lombok.*;

import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@Builder
@Getter
@Setter
public class ResponseTokenInfo {

    private String firstName;
    private String lastName;
    private String email;
    private UUID userId;

}
