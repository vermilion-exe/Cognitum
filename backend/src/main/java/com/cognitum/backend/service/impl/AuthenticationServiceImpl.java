package com.cognitum.backend.service.impl;

import com.cognitum.backend.dto.request.RequestAuthentication;
import com.cognitum.backend.dto.request.RequestChangePassword;
import com.cognitum.backend.dto.request.RequestConfirmation;
import com.cognitum.backend.dto.request.RequestRegister;
import com.cognitum.backend.dto.response.*;
import com.cognitum.backend.entity.Attachment;
import com.cognitum.backend.entity.Note;
import com.cognitum.backend.entity.Token;
import com.cognitum.backend.entity.User;
import com.cognitum.backend.enums.TokenType;
import com.cognitum.backend.exception.BadRequestException;
import com.cognitum.backend.exception.NotFoundException;
import com.cognitum.backend.exception.ResourceConflictException;
import com.cognitum.backend.properties.ApplicationProperties;
import com.cognitum.backend.repository.*;
import com.cognitum.backend.service.AuthenticationService;
import com.cognitum.backend.service.EmailService;
import com.cognitum.backend.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class AuthenticationServiceImpl implements AuthenticationService {

    private final UserRepository userRepository;
    private final TokenRepository tokenRepository;
    private final NoteRepository noteRepository;
    private final SummaryRepository summaryRepository;
    private final ExplanationRepository explanationRepository;
    private final FlashcardRepository flashcardRepository;
    private final AttachmentRepository attachmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationProperties applicationProperties;
    private final JwtService jwtService;
    private final EmailService emailService;

    @Override
    public ResponseEntity<ResponseAuthentication> register(RequestRegister requestRegister) {
        // Do not allow duplicate accounts for the same email
        userRepository.findByEmail(requestRegister.getEmail()).ifPresent(user -> {
            throw new ResourceConflictException("User with email " + requestRegister.getEmail() + " already exists");
        });

        // Create the user and either activate immediately or send a code
        User user = new User();
        user.setEmail(requestRegister.getEmail());
        user.setPassword(passwordEncoder.encode(requestRegister.getPassword()));
        user.setUsername(requestRegister.getUsername());
        Long confirmationCode = generateRandomConfirmationCode();
        user.setCode(confirmationCode);

        if (applicationProperties.getIsDevMode())
            user.setIsActive(true);
        else{
                user.setIsActive(false);
                emailService.sendEmail(user.getEmail(), confirmationCode, false);
        }

        User savedUser = userRepository.save(user);
        if(savedUser.getId() != null){
            // Return an initial token pair after successful registration
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
                .orElseThrow(() -> new NotFoundException("User with email " + requestAuthentication.getEmail() + " not found"));

        // Replace old access tokens when credentials are valid
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
                .orElseThrow(() -> new NotFoundException("User with email " + user.getEmail() + " not found")));
        return new ResponseOperation(true);
    }

    private void saveUserToken(User user, String jwtToken) {
        // Store active access tokens so logout can revoke them
        Token token = Token.builder().token(jwtToken).user(user).tokenType(TokenType.BEARER).expired(false).revoked(false).build();
        tokenRepository.save(token);
    }

    private void revokeAllUserTokens(User user) {
        // Mark all previous access tokens unusable
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
        // Use a valid refresh token to issue a new access token
        userEmail = jwtService.extractUsername(refreshToken);
        if(userEmail != null){
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new NotFoundException("User with email " + userEmail + " not found"));

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
        // Activate only when the submitted code matches the saved one
        if(user.isPresent() && user.get().getCode().equals(requestConfirmation.getCode())){
            user.get().setIsActive(true);
            userRepository.save(user.get());
        }
        return new ResponseOperation(true);
    }

    @Override
    public ResponseEntity<Boolean> emailSendCode(String email, Boolean isChangePassword) {
        // Generate and email a fresh confirmation code
        return userRepository.findByEmail(email)
                .map(user -> {
                    Long confirmationCode = generateRandomConfirmationCode();
                    user.setCode(confirmationCode);
                    userRepository.save(user);

                    emailService.sendEmail(email, confirmationCode, isChangePassword);

                    return ResponseEntity.ok(true);
                }).orElse(ResponseEntity.badRequest().body(false));
    }

    @Override
    public ResponseEntity<Boolean> changePassword(RequestChangePassword changePassword) {
        Optional<User> user = userRepository.findByEmail(changePassword.getEmail());

        if(user.isEmpty()){
            return ResponseEntity.badRequest().body(false);
        }

        boolean isConfirmPasswordValid =validateConfirmPassword(changePassword);
        boolean isConfirmationCodeValid = validateConfirmationCode(user.get(), changePassword.getEmailConfirmCode());

        // Require both the email code and repeated password to match
        if(!isConfirmationCodeValid || !isConfirmPasswordValid){
            return ResponseEntity.badRequest().body(false);
        }

        user.get().setPassword(passwordEncoder.encode(changePassword.getNewPassword()));
        userRepository.save(user.get());

        return ResponseEntity.ok().body(true);
    }

    @Override
    public ResponseUserInfo getUser(String token) {
        ResponseUser user = jwtService.getTokenInfo(token);
        User userEntity = userRepository.findByEmail(user.getEmail())
                .orElseThrow(() -> new NotFoundException("User with email " + user.getEmail() + " not found"));
        return ResponseUserInfo.builder().email(userEntity.getEmail()).username(userEntity.getActualUsername()).profilePictureUrl(userEntity.getProfilePictureUrl()).build();
    }

    private Boolean validateConfirmPassword(RequestChangePassword changePassword){
        return changePassword.getConfirmPassword().equalsIgnoreCase(changePassword.getNewPassword());
    }

    private Boolean validateConfirmationCode(User user, Long confirmationCode){
        return user.getCode().equals(confirmationCode);
    }

    private Long generateRandomConfirmationCode(){
        SecureRandom random = new SecureRandom();
        return Long.parseLong(IntStream.range(0, 6).mapToObj(i -> String.valueOf(random.nextInt(10))).collect(Collectors.joining()));
    }

    @Transactional
    @Override
    public ResponseOperation removeUser(String token) {
        // Remove user-owned data before deleting the account
        ResponseUser user = jwtService.getTokenInfo(token);
        removeData(user.getId());
        tokenRepository.deleteAllByUserId(user.getId());
        userRepository.deleteById(user.getId());
        return new ResponseOperation(true);
    }

    private void removeData(UUID userId) {
        // Delete child records for each note before deleting notes
        List<Note> notes = noteRepository.findAllByUserId(userId);
        notes.forEach(note -> {
            summaryRepository.getSummaryByNoteId(note.getId())
                    .ifPresent(summary -> summaryRepository.deleteById(summary.getId()));
            explanationRepository.findAllByNoteId(note.getId()).forEach(explanation ->
                    explanationRepository.deleteById(explanation.getId()));
            flashcardRepository.findAllByNoteId(note.getId()).forEach(flashcard ->
                    flashcardRepository.deleteById(flashcard.getId()));
        });
        noteRepository.deleteAll(notes);

        attachmentRepository.deleteAllByUserId(userId);
    }

    @Override
    public ResponseAttachment createAttachment(String token, MultipartFile file, String path, OffsetDateTime createdAt, OffsetDateTime lastUpdated) {
        if (file.isEmpty())
            throw new BadRequestException("Attachment is empty");

        try {
            ResponseUser user = jwtService.getTokenInfo(token);

            Attachment attachment = new Attachment();

            // Reuse the existing attachment id when the path already exists
            Optional<Attachment> optionalAttachment = attachmentRepository.findByPathAndUserId(path, user.getId());

            optionalAttachment.ifPresent(value -> attachment.setId(value.getId()));

            attachment.setPath(path);
            attachment.setContentType(file.getContentType());
            attachment.setBytes(file.getBytes());
            attachment.setCreatedAt(createdAt != null ? createdAt : OffsetDateTime.now());
            attachment.setLastUpdated(lastUpdated != null ? lastUpdated : OffsetDateTime.now());
            attachment.setUserId(user.getId());

            Attachment savedAttachment = attachmentRepository.save(attachment);

            return new ResponseAttachment(savedAttachment.getId(), savedAttachment.getPath(), savedAttachment.getContentType(), savedAttachment.getCreatedAt(), savedAttachment.getLastUpdated(), savedAttachment.getBytes());
        } catch (Exception ignored) {return null;}
    }

    @Override
    public List<ResponseAttachment> getAttachments(String token) {
        ResponseUser user = jwtService.getTokenInfo(token);
        List<Attachment> attachments = attachmentRepository.findByUserId(user.getId());

        return attachments.stream()
                .map(attachment -> new ResponseAttachment(attachment.getId(), attachment.getPath(), attachment.getContentType(), attachment.getCreatedAt(), attachment.getLastUpdated(), attachment.getBytes()))
                .toList();
    }

    @Override
    public ResponseOperation moveAttachment(String token, String oldPath, String newPath) {
        ResponseUser user = jwtService.getTokenInfo(token);

        // Attachment paths are kept in sync with local file moves
        Attachment attachment = attachmentRepository.findByPathAndUserId(oldPath, user.getId())
                .orElseThrow(() -> new NotFoundException("Attachment not found!"));

        attachment.setPath(newPath);
        attachmentRepository.save(attachment);

        return new ResponseOperation(true);
    }

    @Override
    public ResponseOperation deleteAttachment(String token, String path) {
        ResponseUser user = jwtService.getTokenInfo(token);

        Attachment attachment = attachmentRepository.findByPathAndUserId(path, user.getId())
                .orElseThrow(() -> new NotFoundException("Attachment not found!"));

        attachmentRepository.delete(attachment);

        return new ResponseOperation(true);
    }

}
