package com.cognitum.backend.integration;

import com.cognitum.backend.dto.request.RequestRegister;
import com.cognitum.backend.dto.response.ResponseAuthentication;
import com.cognitum.backend.entity.User;
import com.cognitum.backend.repository.TokenRepository;
import com.cognitum.backend.repository.UserRepository;
import com.cognitum.backend.service.EmailService;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static io.restassured.RestAssured.given;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doNothing;

public class LogoutIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TokenRepository tokenRepository;

    @MockitoBean
    private EmailService emailService;

    private ResponseAuthentication registerUser(RequestRegister request) {
        Response response = given()
                .contentType(ContentType.JSON)
                .body(request)
                .when()
                .post("/api/cognitum/auth/register");

        response.then().log().ifValidationFails();

        return response
                .then()
                .statusCode(200)
                .extract()
                .as(ResponseAuthentication.class);
    }

    @BeforeEach
    void setUp() {
        RestAssured.baseURI = "http://localhost:" + super.port;
        tokenRepository.deleteAll();
        userRepository.deleteAll();
        doNothing().when(emailService).sendEmail(anyString(), anyLong(), anyBoolean());
    }

    @Nested
    @DisplayName("POST /api/cognitum/auth/logout")
    class LogoutTests {
        @Test
        @DisplayName("Should logout successfully")
        void shouldLogoutSuccessfully() {
            var registerRequest = new RequestRegister("testuser", "testuser@test.com", "password123");
            var authResponse = registerUser(registerRequest);
            User user = userRepository.findByEmail(registerRequest.getEmail()).orElseThrow(() -> new RuntimeException("user not found."));
            user.setIsActive(true);
            userRepository.save(user);

            given()
                    .header("Authorization", "Bearer " + authResponse.getAccessToken())
                    .when()
                    .post("/api/cognitum/auth/logout")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("success", org.hamcrest.Matchers.equalTo(true));
        }

        @Test
        @DisplayName("Should return 401 for invalid token")
        void shouldReturn401ForInvalidToken() {
            given()
                    .header("Authorization", "Bearer invalidtoken")
                    .when()
                    .post("/api/cognitum/auth/logout")
                    .then()
                    .statusCode(401);
        }

    }

}
