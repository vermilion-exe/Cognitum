package com.cognitum.backend.dto.response;

import lombok.*;

import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@Builder
@Getter
@Setter
public class ResponseUser {

    UUID id;
    String username;
    String email;
    String password;
    String profilePictureUrl;

}
