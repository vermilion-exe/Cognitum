package com.cognitum.backend.service.impl;

import com.cognitum.backend.service.EmailService;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender javaMailSender;

    @Override
    public void sendEmail(String email, Long confirmCode, Boolean isChangePassword) {
        String subject = isChangePassword ? "Confirmation Code for Password Change" : "Confirmation Code for Email Confirmation";
        try {
            MimeMessage mimeMessage = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "utf-8");
            helper.setText("Your confirmation code : " + confirmCode, true);
            helper.setTo(email);
            helper.setSubject(subject);
            helper.setFrom("cognitumapp@gmail.com");
            javaMailSender.send(mimeMessage);
        }
        catch (Exception ex) {
            System.out.println(ex.getLocalizedMessage());
        }
    }
}
