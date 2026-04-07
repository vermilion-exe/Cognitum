package com.cognitum.backend.config;

import com.cognitum.backend.dto.response.ResponseUserPrincipal;
import com.cognitum.backend.repository.TokenRepository;
import com.cognitum.backend.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final TokenRepository tokenRepository;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {
        final String authHeader = request.getHeader("Authorization");
        final String token;
        final String userEmail;
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }
        token = extractToken(request);
        userEmail = jwtService.extractUsername(token);
        if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = this.userDetailsService.loadUserByUsername(userEmail);
            var isTokenValid = tokenRepository.findByToken(token)
                    .map(t -> !t.getExpired() && !t.getRevoked())
                    .orElse(false);
            if (jwtService.isTokenValid(token, userDetails) && isTokenValid && userDetails.isEnabled()) {
                UsernamePasswordAuthenticationToken authToken = toAuthenticationToken(toPrincipal(request, response));
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
            else {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.getWriter().write("Unauthorized");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private ResponseUserPrincipal toPrincipal(HttpServletRequest request, HttpServletResponse response) {
        ResponseUserPrincipal principal = new ResponseUserPrincipal();
        principal.setToken(response.getHeader("Authorization"));
        return principal;
    }

    private UsernamePasswordAuthenticationToken toAuthenticationToken(ResponseUserPrincipal principal) {
        return new UsernamePasswordAuthenticationToken(principal, null, Collections.emptyList());
    }

    private String extractToken(HttpServletRequest request) {
        final String authorizationHeader = request.getHeader("Authorization");
        if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
            return authorizationHeader.substring(7);
        }
        return null;
    }

}
