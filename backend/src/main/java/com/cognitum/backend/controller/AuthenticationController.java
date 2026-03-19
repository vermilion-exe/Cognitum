package com.cognitum.backend.controller;

import com.cognitum.backend.dto.request.RequestConfirmation;
import com.cognitum.backend.dto.request.RequestRefreshToken;
import com.cognitum.backend.dto.request.RequestRegister;
import com.cognitum.backend.dto.request.RequestAuthentication;
import com.cognitum.backend.dto.response.ResponseAuthentication;
import com.cognitum.backend.dto.response.ResponseUserInfo;
import com.cognitum.backend.service.AuthenticationService;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    @PostMapping("/logout")
    public void logout(@RequestHeader(value = "Authorization") String token) {
        service.logout(token);
    }

    @SneakyThrows
    @PostMapping("/refresh-token")
    public void refreshToken(@RequestBody RequestRefreshToken body) {
        service.refreshToken(body.getRequest(), body.getResponse());
    }

    @PostMapping("/confirm")
    public void confirmUser(@RequestBody RequestConfirmation requestConfirmation) {
        service.confirmUser(requestConfirmation);
    }

//    @GetMapping("/email")
//    public ResponseEntity<Boolean> emailSendCodeChangePassword(@RequestParam("email") String email) {
//        return service.emailSendCodeChangePassword(email);
//    }

//    @PostMapping("/change-password")
//    public ResponseEntity<Boolean> changePassword(@RequestBody RequestChangePassword changePassword) {
//        return service.changePassword(changePassword);
//    }
//
//    @PostMapping("/change-username")
//    public ResponseEntity<Boolean> changeUsername(@RequestHeader(value = "Authorization") String token,
//                                                  @RequestBody RequestChangeUsername changeUsername) {
//        return service.changeUsername(token, changeUsername);
//    }

    @GetMapping("/user")
    public ResponseUserInfo getUser(@RequestHeader(value = "Authorization") String token) {
        return service.getUser(token);
    }

    @DeleteMapping
    public void removeUser(@RequestHeader(value = "Authorization") String token) {
        service.removeUser(token);
    }

}
