package com.cognitum.backend.service;

import com.cognitum.backend.dto.response.ResponseTokenInfo;
import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.entity.User;
import io.jsonwebtoken.Claims;
import org.springframework.security.core.userdetails.UserDetails;

import java.security.Key;
import java.util.Map;
import java.util.function.Function;

public interface JwtService {

    String extractUsername(String token);
    <T> T extractClaim(String token, Function<Claims, T> claimsResolver);
    String generateToken(User user);
    String generateToken(Map<String, Object> extraClaims, UserDetails userDetails);
    String generateRefreshToken(User user);
    boolean isTokenValid(String token, UserDetails userDetails);
    ResponseUser getTokenInfo(String token);

}
