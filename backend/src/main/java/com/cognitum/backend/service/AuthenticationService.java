package com.cognitum.backend.service;

import com.cognitum.backend.dto.request.RequestAuthentication;
import com.cognitum.backend.dto.request.RequestChangePassword;
import com.cognitum.backend.dto.request.RequestConfirmation;
import com.cognitum.backend.dto.request.RequestRegister;
import com.cognitum.backend.dto.response.ResponseAuthentication;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.dto.response.ResponseUserInfo;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;

public interface AuthenticationService {

    ResponseEntity<ResponseAuthentication> register(RequestRegister requestRegister);
    ResponseEntity<ResponseAuthentication> authenticate(RequestAuthentication requestAuthentication);
    ResponseOperation logout(String token);
    ResponseEntity<ResponseAuthentication> refreshToken(HttpServletRequest request, HttpServletResponse response);
    ResponseOperation confirmUser(RequestConfirmation requestConfirmation);
    ResponseEntity<Boolean> emailSendCode(String email, Boolean isChangePassword);
    ResponseEntity<Boolean> changePassword(RequestChangePassword changePassword);
//    ResponseEntity<Boolean> changeUsername(String token, RequestChangeUsername changeUsername);
    ResponseUserInfo getUser(String token);
    ResponseOperation removeUser(String token);

}
