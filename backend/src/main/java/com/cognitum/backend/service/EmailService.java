package com.cognitum.backend.service;

public interface EmailService {

    void sendEmail(String email, Long confirmCode, Boolean isChangePassword);

}
