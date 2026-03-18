package com.cognitum.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class ResponseUserPrincipal {

    private final String transactionNumber = UUID.randomUUID().toString();
    private String token;

}
