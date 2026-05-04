package com.cognitum.backend.controller;

import com.cognitum.backend.dto.request.*;
import com.cognitum.backend.dto.response.ResponseAttachment;
import com.cognitum.backend.dto.response.ResponseAuthentication;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.dto.response.ResponseUserInfo;
import com.cognitum.backend.service.AuthenticationService;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/cognitum/auth")
public class AuthenticationController {

    private final AuthenticationService service;

    @PostMapping("/register")
    public ResponseEntity<ResponseAuthentication> register(
            @RequestBody RequestRegister request
    ) {
        return service.register(request);
    }

    @PostMapping("/authenticate")
    public ResponseEntity<ResponseAuthentication> authenticate(
            @RequestBody RequestAuthentication request
    ) {
        return service.authenticate(request);
    }

//    @PostMapping("/logout")
//    public ResponseOperation logout(@RequestHeader("Authorization") String token) {
//        return service.logout(token);
//    }

    @SneakyThrows
    @PostMapping("/refresh-token")
    public ResponseEntity<ResponseAuthentication> refreshToken(@RequestBody RequestRefreshToken body) {
        return service.refreshToken(body.getRequest(), body.getResponse());
    }

    @PostMapping("/confirm")
    public ResponseOperation confirmUser(@RequestBody RequestConfirmation requestConfirmation) {
        return service.confirmUser(requestConfirmation);
    }

    @GetMapping("/email")
    public ResponseEntity<Boolean> emailSendCode(@RequestParam("email") String email, @RequestParam("isChangePassword") Boolean isChangePassword) {
        return service.emailSendCode(email, isChangePassword);
    }

    @PostMapping("/change-password")
    public ResponseEntity<Boolean> changePassword(@RequestBody RequestChangePassword changePassword) {
        return service.changePassword(changePassword);
    }

    @GetMapping("/user")
    public ResponseUserInfo getUser(@RequestHeader(value = "Authorization") String token) {
        return service.getUser(token);
    }

    @DeleteMapping
    public ResponseOperation removeUser(@RequestHeader(value = "Authorization") String token) {
        return service.removeUser(token);
    }

    @PostMapping("/upload")
    public ResponseAttachment createAttachment(@RequestHeader("Authorization") String token,
                                               @RequestParam MultipartFile file,
                                               @RequestParam String path,
                                               @RequestParam(required = false) OffsetDateTime createdAt,
                                                @RequestParam(required = false) OffsetDateTime lastUpdated) {
        return service.createAttachment(token, file, path, createdAt, lastUpdated);
    }

    @GetMapping("/attachment")
    public List<ResponseAttachment> getAttachments(@RequestHeader("Authorization") String token) {
        return service.getAttachments(token);
    }

    @PutMapping("/attachment/move")
    public ResponseOperation moveAttachment(@RequestHeader("Authorization") String token, @RequestParam String oldPath, @RequestParam String newPath) {
        return service.moveAttachment(token, oldPath, newPath);
    }

    @DeleteMapping("/attachment")
    public ResponseOperation deleteAttachment(@RequestHeader("Authorization") String token, @RequestParam String path) {
        return service.deleteAttachment(token, path);
    }

}
