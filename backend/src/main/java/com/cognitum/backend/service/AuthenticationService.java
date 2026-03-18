package com.cognitum.backend.service;

import com.cognitum.backend.dto.request.RequestAuthentication;
import com.cognitum.backend.dto.request.RequestConfirmation;
import com.cognitum.backend.dto.request.RequestRegister;
import com.cognitum.backend.dto.response.ResponseAuthentication;
import com.cognitum.backend.dto.response.ResponseUserInfo;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;

public interface AuthenticationService {

    ResponseEntity<ResponseAuthentication> register(RequestRegister requestRegister);
    ResponseEntity<ResponseAuthentication> authenticate(RequestAuthentication requestAuthentication);
    void logout(String token);
    void refreshToken(HttpServletRequest request, HttpServletResponse response);
    void confirmUser(RequestConfirmation requestConfirmation);
//    ResponseEntity<Boolean> emailSendCodeChangePassword(String email);
//    ResponseEntity<Boolean> changePassword(RequestChangePassword changePassword);
//    ResponseEntity<Boolean> changeUsername(String token, RequestChangeUsername changeUsername);
    ResponseUserInfo getUser(String token);
    void removeUser(String token);

}
