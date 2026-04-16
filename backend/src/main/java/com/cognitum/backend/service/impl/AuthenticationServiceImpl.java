package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestAuthentication;
import com.cognitum.backend.dto.request.RequestConfirmation;
import com.cognitum.backend.dto.request.RequestRegister;
import com.cognitum.backend.dto.response.ResponseAuthentication;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.dto.response.ResponseUser;
import com.cognitum.backend.dto.response.ResponseUserInfo;
import com.cognitum.backend.entity.Token;
import com.cognitum.backend.entity.User;
import com.cognitum.backend.enums.TokenType;
import com.cognitum.backend.repository.TokenRepository;
import com.cognitum.backend.repository.UserRepository;
import com.cognitum.backend.service.AuthenticationService;
import com.cognitum.backend.service.EmailService;
import com.cognitum.backend.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class AuthenticationServiceImpl implements AuthenticationService {

    private final UserRepository userRepository;
    private final TokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;

    @Override
    public ResponseEntity<ResponseAuthentication> register(RequestRegister requestRegister) {
        userRepository.findByEmail(requestRegister.getEmail()).ifPresent(user -> {
            throw new IllegalArgumentException("User with email " + requestRegister.getEmail() + " already exists");
        });

        User user = new User();
        user.setEmail(requestRegister.getEmail());
        user.setPassword(passwordEncoder.encode(requestRegister.getPassword()));
        user.setUsername(requestRegister.getUsername());
        Long confirmationCode = generateRandomConfirmationCode();
        user.setCode(confirmationCode);
        emailService.sendEmail(user.getEmail(), confirmationCode, false);

        User savedUser = userRepository.save(user);
        if(savedUser.getId() != null){
            var jwtToken = jwtService.generateToken(savedUser);
            var refreshToken = jwtService.generateRefreshToken(savedUser);

            saveUserToken(savedUser, jwtToken);
            return ResponseEntity.ok(ResponseAuthentication.builder()
                    .accessToken(jwtToken)
                    .refreshToken(refreshToken)
                    .userId(savedUser.getId())
                    .isActive(savedUser.getIsActive())
                    .username(savedUser.getActualUsername())
                    .email(savedUser.getEmail())
                    .build());
        }

        return ResponseEntity.badRequest().body(new ResponseAuthentication());
    }

    @Override
    public ResponseEntity<ResponseAuthentication> authenticate(RequestAuthentication requestAuthentication) {
        User user = userRepository.findByEmail(requestAuthentication.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User with email " + requestAuthentication.getEmail() + " not found"));

        if(passwordEncoder.matches(requestAuthentication.getPassword(), user.getPassword())){
            var jwtToken = jwtService.generateToken(user);
            var refreshToken = jwtService.generateRefreshToken(user);

            revokeAllUserTokens(user);
            saveUserToken(user, jwtToken);
            return ResponseEntity.ok(ResponseAuthentication.builder()
                    .accessToken(jwtToken)
                    .refreshToken(refreshToken)
                    .userId(user.getId())
                    .isActive(user.getIsActive())
                    .username(user.getActualUsername())
                    .email(user.getEmail())
                    .build());
        }

        return ResponseEntity.badRequest().body(new ResponseAuthentication());
    }

    @Override
    public ResponseOperation logout(String token) {
        ResponseUser user = jwtService.getTokenInfo(token);
        revokeAllUserTokens(userRepository.findByEmail(user.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User with email " + user.getEmail() + " not found")));
        return new ResponseOperation(true);
    }

    private void saveUserToken(User user, String jwtToken) {
        Token token = Token.builder().token(jwtToken).user(user).tokenType(TokenType.BEARER).expired(false).revoked(false).build();
        tokenRepository.save(token);
    }

    private void revokeAllUserTokens(User user) {
        tokenRepository.findAllByUserId(user.getId()).forEach(token -> {
            token.setExpired(true);
            token.setRevoked(true);
            tokenRepository.save(token);
        });
    }

    @SneakyThrows
    @Override
    public ResponseEntity<ResponseAuthentication> refreshToken(HttpServletRequest request, HttpServletResponse response) {
        final String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        final String refreshToken;
        final String userEmail;
        if(authHeader == null || !authHeader.startsWith("Bearer ")){
            return ResponseEntity.badRequest().body(new ResponseAuthentication());
        }
        refreshToken = authHeader.substring(7);
        userEmail = jwtService.extractUsername(refreshToken);
        if(userEmail != null){
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new IllegalArgumentException("User with email " + userEmail + " not found"));

            if(jwtService.isTokenValid(refreshToken, user)) {
                var jwtToken = jwtService.generateToken(user);
                revokeAllUserTokens(user);
                saveUserToken(user, jwtToken);
                response.setHeader(HttpHeaders.AUTHORIZATION, jwtToken);

                return ResponseEntity.ok(ResponseAuthentication.builder()
                        .accessToken(jwtToken)
                        .refreshToken(refreshToken)
                        .userId(user.getId())
                        .isActive(user.getIsActive())
                        .username(user.getActualUsername())
                        .email(user.getEmail())
                        .build());
            }
        }

        return ResponseEntity.badRequest().body(new ResponseAuthentication());
    }

    @Override
    public ResponseOperation confirmUser(RequestConfirmation requestConfirmation) {
        Optional<User> user = userRepository.findByEmail(requestConfirmation.getEmail());
        if(user.isPresent() && user.get().getCode().equals(requestConfirmation.getCode())){
            user.get().setIsActive(true);
            userRepository.save(user.get());
        }
        return new ResponseOperation(true);
    }

    @Override
    public ResponseEntity<Boolean> emailSendCode(String email, Boolean isChangePassword) {
        return userRepository.findByEmail(email)
                .map(user -> {
                    Long confirmationCode = generateRandomConfirmationCode();
                    user.setCode(confirmationCode);
                    userRepository.save(user);

                    emailService.sendEmail(email, confirmationCode, isChangePassword);

                    return ResponseEntity.ok(true);
                }).orElse(ResponseEntity.badRequest().body(false));
    }

//    @Override
//    public ResponseEntity<Boolean> changePassword(RequestChangePassword changePassword) {
//        Optional<User> user = userRepository.findByEmail(changePassword.getEmail());
//
//        if(user.isEmpty()){
//            return ResponseEntity.badRequest().body(false);
//        }
//
//        boolean isConfirmPasswordValid =validateConfirmPassword(changePassword);
//        boolean isConfirmationCodeValid = validateConfirmationCode(user.get(), changePassword.getEmailConfirmCode());
//
//        if(!isConfirmationCodeValid || !isConfirmPasswordValid){
//            return ResponseEntity.badRequest().body(false);
//        }
//
//        user.get().setPassword(passwordEncoder.encode(changePassword.getNewPassword()));
//        userRepository.save(user.get());
//
//        return ResponseEntity.ok().body(true);
//    }
//
//    @Override
//    public ResponseEntity<Boolean> changeUsername(String token, RequestChangeUsername changeUsername) {
//        ResponseUser user = jwtService.getTokenInfo(token);
//        Optional<User> userOptional = userRepository.findByEmail(user.getEmail());
//
//        if(userOptional.isEmpty()){
//            return ResponseEntity.badRequest().body(false);
//        }
//
//        userOptional.get().setUsername(changeUsername.getUsername());
//        userRepository.save(userOptional.get());
//
//        return ResponseEntity.ok().body(true);
//    }

    @Override
    public ResponseUserInfo getUser(String token) {
        ResponseUser user = jwtService.getTokenInfo(token);
        User userEntity = userRepository.findByEmail(user.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User with email " + user.getEmail() + " not found"));
        return ResponseUserInfo.builder().email(userEntity.getEmail()).username(userEntity.getActualUsername()).profilePictureUrl(userEntity.getProfilePictureUrl()).build();
    }

//    private Boolean validateConfirmPassword(RequestChangePassword changePassword){
//        return changePassword.getConfirmPassword().equalsIgnoreCase(changePassword.getNewPassword());
//    }

//    private Boolean validateConfirmationCode(User user, Long confirmationCode){
//        return user.getCode().equals(confirmationCode);
//    }

    private Long generateRandomConfirmationCode(){
        SecureRandom random = new SecureRandom();
        return Long.parseLong(IntStream.range(0, 6).mapToObj(i -> String.valueOf(random.nextInt(10))).collect(Collectors.joining()));
    }

    @Override
    public void removeUser(String token) {
        ResponseUser user = jwtService.getTokenInfo(token);
//        removeData(user.getId());
        userRepository.deleteById(user.getId());
    }

}
