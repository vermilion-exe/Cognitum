package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.repository.TokenRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.LogoutHandler;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;

@Service
@RequiredArgsConstructor
public class LogoutServiceImpl implements LogoutHandler {

    private final TokenRepository tokenRepository;

    @Override
    public void logout(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        final String authHeader = request.getHeader("Authorization");
        final String token;
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return;
        }
        token = authHeader.substring(7);
        var storedToken = tokenRepository.findByToken(token)
                .orElse(null);
        if (storedToken != null) {
            storedToken.setExpired(true);
            storedToken.setRevoked(true);
            tokenRepository.save(storedToken);
            SecurityContextHolder.clearContext();
        }
        response.setContentType("application/json");
        response.setStatus(HttpServletResponse.SC_OK);
        try {
            new ObjectMapper().writeValue(response.getOutputStream(), new ResponseOperation(true));
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

}
