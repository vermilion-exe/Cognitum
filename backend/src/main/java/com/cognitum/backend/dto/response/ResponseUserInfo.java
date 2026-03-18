package com.cognitum.backend.dto.response;

import lombok.*;

@AllArgsConstructor
@NoArgsConstructor
@Builder
@Getter
@Setter
public class ResponseUserInfo {

    private String username;
    private String email;
    private String profilePictureUrl;

}
