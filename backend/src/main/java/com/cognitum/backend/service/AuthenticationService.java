package com.cognitum.backend.service;

import com.cognitum.backend.dto.request.RequestAuthentication;
import com.cognitum.backend.dto.request.RequestChangePassword;
import com.cognitum.backend.dto.request.RequestConfirmation;
import com.cognitum.backend.dto.request.RequestRegister;
import com.cognitum.backend.dto.response.ResponseAttachment;
import com.cognitum.backend.dto.response.ResponseAuthentication;
import com.cognitum.backend.dto.response.ResponseOperation;
import com.cognitum.backend.dto.response.ResponseUserInfo;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;

import java.time.OffsetDateTime;
import java.util.List;

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
    ResponseAttachment createAttachment(String token, MultipartFile file, String path, OffsetDateTime createdAt, OffsetDateTime lastUpdated);
    List<ResponseAttachment> getAttachments(String token);
    ResponseOperation moveAttachment(String token, String oldPath, String newPath);
    ResponseOperation deleteAttachment(String token, String path);

}
