package com.cognitum.backend.dto.request;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RequestRefreshToken {

    private HttpServletRequest request;
    private HttpServletResponse response;

}
