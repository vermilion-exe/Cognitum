package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestAuthentication;
import com.cognitum.backend.dto.request.RequestConfirmation;
import com.cognitum.backend.dto.request.RequestRegister;
import com.cognitum.backend.dto.response.ResponseAuthentication;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.entity.Token;
import com.cognitum.backend.entity.User;
import com.cognitum.backend.exception.NotFoundException;
import com.cognitum.backend.exception.ResourceConflictException;
import com.cognitum.backend.properties.ApplicationProperties;
import com.cognitum.backend.repository.AttachmentRepository;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.repository.TokenRepository;
import com.cognitum.backend.repository.UserRepository;
import com.cognitum.backend.service.EmailService;
import com.cognitum.backend.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthenticationServiceImplTest {

    private static final String RAW_PASSWORD = "Testpassword123";
    private static final String ENCODED_PASSWORD = "encodedPassword123";

    @Mock
    private UserRepository userRepository;

    @Mock
    private TokenRepository tokenRepository;

    @Mock
    private NoteRepository noteRepository;

    @Mock
    private AttachmentRepository attachmentRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private ApplicationProperties applicationProperties;

    @Mock
    private JwtService jwtService;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private AuthenticationServiceImpl authenticationService;

    private User mockUser;
    private String mockToken;

    @BeforeEach
    void setUp() {
        mockUser = new User();
        mockUser.setId(UUID.randomUUID());
        mockUser.setEmail("test@example.com");
        mockUser.setUsername("testuser");
        mockUser.setPassword(ENCODED_PASSWORD);
        mockUser.setIsActive(true);

        mockToken = "mock-jwt-token";
    }

    @Test
    void register_withValidData_createsUserAndReturnsResponse() {
        RequestRegister requestRegister = new RequestRegister();
        requestRegister.setEmail("newuser@example.com");
        requestRegister.setPassword(RAW_PASSWORD);
        requestRegister.setUsername("newuser");

        UUID savedUserId = UUID.randomUUID();
        User savedUser = new User();
        savedUser.setId(savedUserId);
        savedUser.setEmail("newuser@example.com");
        savedUser.setUsername("newuser");
        savedUser.setPassword(ENCODED_PASSWORD);
        savedUser.setIsActive(false);

        when(userRepository.findByEmail("newuser@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(RAW_PASSWORD)).thenReturn(ENCODED_PASSWORD);
        when(applicationProperties.getIsTestMode() ).thenReturn(false);
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtService.generateToken(savedUser)).thenReturn("jwt-token");
        when(jwtService.generateRefreshToken(savedUser)).thenReturn("refresh-token");

        ResponseEntity<ResponseAuthentication> response = authenticationService.register(requestRegister);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals("jwt-token", response.getBody().getAccessToken());
        assertEquals("refresh-token", response.getBody().getRefreshToken());
        assertEquals(savedUserId, response.getBody().getUserId());
        assertFalse(response.getBody().getIsActive());

        verify(userRepository).findByEmail("newuser@example.com");
        verify(passwordEncoder).encode(RAW_PASSWORD);
        verify(userRepository).save(any(User.class));
        verify(jwtService).generateToken(savedUser);
        verify(jwtService).generateRefreshToken(savedUser);
        verify(emailService).sendEmail(anyString(), anyLong(), anyBoolean());
        verify(tokenRepository).save(any(Token.class));
    }

    @Test
    void register_withExistingEmail_throwsResourceConflictException() {
        RequestRegister requestRegister = new RequestRegister();
        requestRegister.setEmail("existing@example.com");
        requestRegister.setPassword(RAW_PASSWORD);
        requestRegister.setUsername("newuser");

        when(userRepository.findByEmail("existing@example.com")).thenReturn(Optional.of(mockUser));

        assertThrows(ResourceConflictException.class, () -> authenticationService.register(requestRegister));

        verify(userRepository).findByEmail("existing@example.com");
        verify(userRepository, never()).save(any(User.class));
        verify(passwordEncoder, never()).encode(anyString());
    }

    @Test
    void authenticate_withValidCredentials_returnsAuthenticationResponse() {
        RequestAuthentication requestAuth = new RequestAuthentication();
        requestAuth.setEmail("test@example.com");
        requestAuth.setPassword(RAW_PASSWORD);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(mockUser));
        when(passwordEncoder.matches(RAW_PASSWORD, ENCODED_PASSWORD)).thenReturn(true);
        when(tokenRepository.findAllByUserId(mockUser.getId())).thenReturn(List.of());
        when(jwtService.generateToken(mockUser)).thenReturn("jwt-token");
        when(jwtService.generateRefreshToken(mockUser)).thenReturn("refresh-token");

        ResponseEntity<ResponseAuthentication> response = authenticationService.authenticate(requestAuth);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals("jwt-token", response.getBody().getAccessToken());
        assertEquals("refresh-token", response.getBody().getRefreshToken());
        assertEquals(mockUser.getId(), response.getBody().getUserId());

        verify(userRepository).findByEmail("test@example.com");
        verify(passwordEncoder).matches(RAW_PASSWORD, ENCODED_PASSWORD);
        verify(jwtService).generateToken(mockUser);
        verify(jwtService).generateRefreshToken(mockUser);
        verify(tokenRepository).save(any(Token.class));
    }

    @Test
    void authenticate_withInvalidEmail_throwsNotFoundException() {
        RequestAuthentication requestAuth = new RequestAuthentication();
        requestAuth.setEmail("nonexistent@example.com");
        requestAuth.setPassword(RAW_PASSWORD);

        when(userRepository.findByEmail("nonexistent@example.com")).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> authenticationService.authenticate(requestAuth));

        verify(userRepository).findByEmail("nonexistent@example.com");
        verify(passwordEncoder, never()).matches(anyString(), anyString());
    }

    @Test
    void authenticate_withInvalidPassword_returnsBadRequest() {
        RequestAuthentication requestAuth = new RequestAuthentication();
        requestAuth.setEmail("test@example.com");
        requestAuth.setPassword("wrongpassword");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(mockUser));
        when(passwordEncoder.matches("wrongpassword", ENCODED_PASSWORD)).thenReturn(false);

        ResponseEntity<ResponseAuthentication> response = authenticationService.authenticate(requestAuth);

        assertNotNull(response);
        assertEquals(400, response.getStatusCode().value());
        assertNotNull(response.getBody());

        verify(userRepository).findByEmail("test@example.com");
        verify(passwordEncoder).matches("wrongpassword", ENCODED_PASSWORD);
        verify(jwtService, never()).generateToken(any(User.class));
    }

    @Test
    void logout_withValidToken_revokesAllUserTokens() {
        String token = "Bearer valid-token";
        ResponseUser responseUser = ResponseUser.builder()
                .email("test@example.com")
                .username("testuser")
                .id(UUID.randomUUID())
                .build();

        Token userToken = new Token();
        userToken.setId(1L);
        userToken.setToken("valid-token");
        userToken.setExpired(false);
        userToken.setRevoked(false);

        when(jwtService.getTokenInfo(token)).thenReturn(responseUser);
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(mockUser));
        when(tokenRepository.findAllByUserId(mockUser.getId())).thenReturn(List.of(userToken));

        ResponseOperation response = authenticationService.logout(token);

        assertNotNull(response);
        assertTrue(response.getSuccess());

        assertTrue(userToken.getExpired());
        assertTrue(userToken.getRevoked());
        verify(tokenRepository).save(userToken);
    }

    @Test
    void refreshToken_withValidRefreshToken_returnsNewTokens() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);

        when(request.getHeader("Authorization")).thenReturn("Bearer refresh-token");
        when(jwtService.extractUsername("refresh-token")).thenReturn("test@example.com");
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(mockUser));
        when(jwtService.isTokenValid("refresh-token", mockUser)).thenReturn(true);
        when(jwtService.generateToken(mockUser)).thenReturn("new-jwt-token");
        when(tokenRepository.findAllByUserId(mockUser.getId())).thenReturn(List.of());

        ResponseEntity<ResponseAuthentication> result = authenticationService.refreshToken(request, response);

        assertNotNull(result);
        assertEquals(200, result.getStatusCode().value());
        assertNotNull(result.getBody());
        assertEquals("new-jwt-token", result.getBody().getAccessToken());
        assertEquals("refresh-token", result.getBody().getRefreshToken());

        verify(response).setHeader("Authorization", "new-jwt-token");
        verify(tokenRepository).save(any(Token.class));
    }

    @Test
    void refreshToken_withInvalidAuthorizationHeader_returnsBadRequest() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);

        when(request.getHeader("Authorization")).thenReturn(null);

        ResponseEntity<ResponseAuthentication> result = authenticationService.refreshToken(request, response);

        assertNotNull(result);
        assertEquals(400, result.getStatusCode().value());
        assertNotNull(result.getBody());

        verify(jwtService, never()).extractUsername(anyString());
    }

    @Test
    void confirmUser_withValidCode_activatesUser() {
        RequestConfirmation requestConfirmation = new RequestConfirmation();
        requestConfirmation.setEmail("test@example.com");
        requestConfirmation.setCode(123456L);

        mockUser.setIsActive(false);
        mockUser.setCode(123456L);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(mockUser));

        ResponseOperation response = authenticationService.confirmUser(requestConfirmation);

        assertNotNull(response);
        assertTrue(response.getSuccess());
        assertTrue(mockUser.getIsActive());
        verify(userRepository).save(mockUser);
    }

    @Test
    void confirmUser_withInvalidCode_doesNotActivateUser() {
        RequestConfirmation requestConfirmation = new RequestConfirmation();
        requestConfirmation.setEmail("test@example.com");
        requestConfirmation.setCode(654321L);

        mockUser.setIsActive(false);
        mockUser.setCode(123456L);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(mockUser));

        ResponseOperation response = authenticationService.confirmUser(requestConfirmation);

        assertNotNull(response);
        assertTrue(response.getSuccess());
        assertFalse(mockUser.getIsActive());
        verify(userRepository, never()).save(mockUser);
    }

    @Test
    void emailSendCode_withExistingEmail_sendsCodeAndReturnsTrue() {
        String email = "test@example.com";
        Boolean isChangePassword = false;

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(mockUser));

        ResponseEntity<Boolean> response = authenticationService.emailSendCode(email, isChangePassword);

        assertNotNull(response);
        assertEquals(Boolean.TRUE, response.getBody());
        verify(userRepository).save(mockUser);
        verify(emailService).sendEmail(email, mockUser.getCode(), isChangePassword);
    }

    @Test
    void emailSendCode_withNonExistingEmail_returnsBadRequest() {
        String email = "nonexistent@example.com";
        Boolean isChangePassword = false;

        when(userRepository.findByEmail(email)).thenReturn(Optional.empty());

        ResponseEntity<Boolean> response = authenticationService.emailSendCode(email, isChangePassword);

        assertNotNull(response);
        assertEquals(400, response.getStatusCode().value());
        assertNotEquals(Boolean.TRUE, response.getBody());
        verify(userRepository, never()).save(any(User.class));
        verify(emailService, never()).sendEmail(anyString(), anyLong(), anyBoolean());
    }

    @Test
    void getUser_withValidToken_returnsUserInfo() {
        String token = "Bearer valid-token";
        ResponseUser responseUser = ResponseUser.builder()
                .email("test@example.com")
                .username("testuser")
                .id(UUID.randomUUID())
                .build();

        when(jwtService.getTokenInfo(token)).thenReturn(responseUser);
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(mockUser));

        var userInfo = authenticationService.getUser(token);

        assertNotNull(userInfo);
        assertEquals("test@example.com", userInfo.getEmail());
        assertEquals("testuser", userInfo.getUsername());
        verify(jwtService).getTokenInfo(token);
        verify(userRepository).findByEmail("test@example.com");
    }

    @Test
    void removeUser_withValidToken_removesUser() {
        String token = "Bearer valid-token";
        UUID userId = mockUser.getId();
        ResponseUser responseUser = ResponseUser.builder()
                .email("test@example.com")
                .username("testuser")
                .id(userId)
                .build();

        when(jwtService.getTokenInfo(token)).thenReturn(responseUser);
        when(noteRepository.findAllByUserId(userId)).thenReturn(List.of());

        authenticationService.removeUser(token);

        verify(jwtService).getTokenInfo(token);
        verify(noteRepository).findAllByUserId(userId);
        verify(tokenRepository).deleteAllByUserId(userId);
        verify(userRepository).deleteById(userId);
    }
}
