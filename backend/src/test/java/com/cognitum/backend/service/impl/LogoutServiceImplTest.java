package com.cognitum.backend.service.impl;

import com.cognitum.backend.entity.Token;
import com.cognitum.backend.repository.TokenRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LogoutServiceImplTest {

    @Mock
    private TokenRepository tokenRepository;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @InjectMocks
    private LogoutServiceImpl logoutService;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void logout_withValidToken_revokesToken() throws IOException {
        String tokenValue = "valid-token";
        Token token = new Token();
        token.setId(1L);
        token.setToken(tokenValue);
        token.setExpired(false);
        token.setRevoked(false);

        when(request.getHeader("Authorization")).thenReturn("Bearer " + tokenValue);
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));
        when(tokenRepository.save(any(Token.class))).thenReturn(token);

        MockHttpServletResponse mockResponse = new MockHttpServletResponse();

        logoutService.logout(request, mockResponse, null);

        assertTrue(token.getExpired());
        assertTrue(token.getRevoked());
        verify(tokenRepository).save(token);
        assertEquals(200, mockResponse.getStatus());
        assertEquals("application/json", mockResponse.getContentType());
    }

    @Test
    void logout_withValidToken_clearsSecurityContext() throws IOException {
        String tokenValue = "valid-token";
        Token token = new Token();
        token.setId(1L);
        token.setToken(tokenValue);

        when(request.getHeader("Authorization")).thenReturn("Bearer " + tokenValue);
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));

        logoutService.logout(request, response, null);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void logout_withNullAuthorizationHeader_returnsWithoutAction() throws IOException {
        when(request.getHeader("Authorization")).thenReturn(null);

        logoutService.logout(request, response, null);

        verify(tokenRepository, never()).findByToken(any());
        verify(tokenRepository, never()).save(any());
    }

    @Test
    void logout_withInvalidAuthorizationHeader_returnsWithoutAction() throws IOException {
        when(request.getHeader("Authorization")).thenReturn("InvalidFormat");

        logoutService.logout(request, response, null);

        verify(tokenRepository, never()).findByToken(any());
        verify(tokenRepository, never()).save(any());
    }

    @Test
    void logout_withNonBearerToken_returnsWithoutAction() throws IOException {
        when(request.getHeader("Authorization")).thenReturn("Basic dGVzdA==");

        logoutService.logout(request, response, null);

        verify(tokenRepository, never()).findByToken(any());
        verify(tokenRepository, never()).save(any());
    }

    @Test
    void logout_whenTokenNotFound_doesNotThrowException() throws IOException {
        String tokenValue = "non-existent-token";

        when(request.getHeader("Authorization")).thenReturn("Bearer " + tokenValue);
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> logoutService.logout(request, response, null));

        verify(tokenRepository, never()).save(any());
    }

    @Test
    void logout_setsCorrectResponseContentType() throws IOException {
        String tokenValue = "valid-token";
        Token token = new Token();
        token.setId(1L);
        token.setToken(tokenValue);

        when(request.getHeader("Authorization")).thenReturn("Bearer " + tokenValue);
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));

        MockHttpServletResponse mockResponse = new MockHttpServletResponse();

        logoutService.logout(request, mockResponse, null);

        assertEquals("application/json", mockResponse.getContentType());
    }

    @Test
    void logout_setsCorrectResponseStatusCode() throws IOException {
        String tokenValue = "valid-token";
        Token token = new Token();
        token.setId(1L);
        token.setToken(tokenValue);

        when(request.getHeader("Authorization")).thenReturn("Bearer " + tokenValue);
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));

        MockHttpServletResponse mockResponse = new MockHttpServletResponse();

        logoutService.logout(request, mockResponse, null);

        assertEquals(200, mockResponse.getStatus());
    }

    @Test
    void logout_returnsJsonResponse() throws IOException {
        String tokenValue = "valid-token";
        Token token = new Token();
        token.setId(1L);
        token.setToken(tokenValue);

        when(request.getHeader("Authorization")).thenReturn("Bearer " + tokenValue);
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));

        MockHttpServletResponse mockResponse = new MockHttpServletResponse();

        logoutService.logout(request, mockResponse, null);

        String content = mockResponse.getContentAsString();
        assertNotNull(content);
        assertTrue(content.contains("true"));
    }

    @Test
    void logout_withEmptyBearerPrefix_handlesGracefully() throws IOException {
        when(request.getHeader("Authorization")).thenReturn("Bearer ");

        assertDoesNotThrow(() -> logoutService.logout(request, response, null));
    }

    @Test
    void logout_withMultipleTokens_usesFirstToken() throws IOException {
        String tokenValue = "first-token";
        Token token = new Token();
        token.setId(1L);
        token.setToken(tokenValue);

        when(request.getHeader("Authorization")).thenReturn("Bearer " + tokenValue);
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));

        logoutService.logout(request, response, null);

        verify(tokenRepository).findByToken(tokenValue);
    }

    @Test
    void logout_revokesTokenOnly() throws IOException {
        String tokenValue = "valid-token";
        Token token = new Token();
        token.setId(1L);
        token.setToken(tokenValue);
        token.setExpired(false);
        token.setRevoked(false);

        when(request.getHeader("Authorization")).thenReturn("Bearer " + tokenValue);
        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));

        logoutService.logout(request, response, null);

        ArgumentCaptor<Token> captor = ArgumentCaptor.forClass(Token.class);
        verify(tokenRepository).save(captor.capture());
        Token capturedToken = captor.getValue();
        assertTrue(capturedToken.getExpired());
        assertTrue(capturedToken.getRevoked());
    }
}
