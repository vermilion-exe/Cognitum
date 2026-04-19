package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.entity.User;
import com.cognitum.backend.properties.JwtProperties;
import com.cognitum.backend.service.JwtService;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class JwtServiceImplTest {

    private JwtService jwtService;

    @Mock
    private JwtProperties jwtProperties;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        when(jwtProperties.getSecretKey()).thenReturn(Base64.getEncoder().encodeToString("test-secret-key-for-jwt-testing-purposes".getBytes()));
        when(jwtProperties.getJwtExpiration()).thenReturn(3600000);
        when(jwtProperties.getRefreshTokenExpiration()).thenReturn(2419200000L);
        jwtService = new JwtServiceImpl(jwtProperties);
    }

    @Test
    void generateToken_withUserDetails_generatesValidToken() {
        User user = createUser("test@example.com", "testuser");

        String token = jwtService.generateToken(user);

        assertNotNull(token);
        assertTrue(token.length() > 0);
    }

    @Test
    void generateToken_containsCorrectClaims() {
        User user = createUser("test@example.com", "testuser");

        String token = jwtService.generateToken(user);

        Claims claims = jwtService.extractClaim(token, c -> c);
        assertEquals("test@example.com", claims.get("email"));
        assertEquals("testuser", claims.get("username"));
    }

    @Test
    void extractUsername_fromValidToken_returnsUsername() {
        User user = createUser("test@example.com", "testuser");
        String token = jwtService.generateToken(user);

        String username = jwtService.extractUsername(token);

        assertEquals("test@example.com", username);
    }

    @Test
    void generateRefreshToken_createsValidToken() {
        User user = createUser("test@example.com", "testuser");

        String refreshToken = jwtService.generateRefreshToken(user);

        assertNotNull(refreshToken);
        assertNotEquals(jwtService.generateToken(user), refreshToken);
    }

    @Test
    void isTokenValid_withValidToken_returnsTrue() {
        User user = createUser("test@example.com", "testuser");
        String token = jwtService.generateToken(user);

        boolean isValid = jwtService.isTokenValid(token, user);

        assertTrue(isValid);
    }

    @Test
    void isTokenValid_withDifferentEmail_returnsFalse() {
        User user = createUser("test@example.com", "testuser");
        User differentUser = createUser("different@example.com", "testuser");
        String token = jwtService.generateToken(user);

        boolean isValid = jwtService.isTokenValid(token, differentUser);

        assertFalse(isValid);
    }

    @Test
    void extractClaim_extractsCustomClaim() {
        User user = createUser("test@example.com", "testuser");
        String token = jwtService.generateToken(user);

        String email = jwtService.extractClaim(token, claims -> claims.get("email", String.class));

        assertEquals("test@example.com", email);
    }

    @Test
    void generateToken_withExtraClaims_includesClaims() {
        User user = createUser("test@example.com", "testuser");
        Map<String, Object> extraClaims = new HashMap<>();
        extraClaims.put("customClaim", "customValue");

        String token = jwtService.generateToken(extraClaims, user);

        assertNotNull(token);
        Claims claims = jwtService.extractClaim(token, c -> c);
        assertEquals("customValue", claims.get("customClaim"));
    }

    @Test
    void getTokenInfo_extractsUserInfoFromToken() {
        User user = createUser("test@example.com", "testuser");
        String token = jwtService.generateToken(user);

        ResponseUser userInfo = jwtService.getTokenInfo("Bearer " + token);

        assertNotNull(userInfo);
        assertEquals("test@example.com", userInfo.getEmail());
        assertEquals("testuser", userInfo.getUsername());
    }

    @Test
    void generateToken_tokenHasExpiration() {
        User user = createUser("test@example.com", "testuser");

        String token = jwtService.generateToken(user);

        Date expiration = jwtService.extractClaim(token, Claims::getExpiration);
        assertNotNull(expiration);
        assertTrue(expiration.after(new Date()));
    }

    @Test
    void generateToken_tokenHasIssuedAt() {
        User user = createUser("test@example.com", "testuser");

        String token = jwtService.generateToken(user);

        Date issuedAt = jwtService.extractClaim(token, Claims::getIssuedAt);
        assertNotNull(issuedAt);
        assertTrue(issuedAt.before(new Date(System.currentTimeMillis() + 1000)));
    }

    private User createUser(String email, String username) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(username);
        user.setId(UUID.randomUUID());
        return user;
    }
}