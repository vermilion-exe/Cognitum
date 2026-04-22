package com.cognitum.backend.integration;

import com.cognitum.backend.dto.request.*;
import com.cognitum.backend.dto.response.*;
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
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

public class AuthIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TokenRepository tokenRepository;

    @MockitoBean
    private EmailService emailService;

    @BeforeEach
    void setUp() {
        RestAssured.baseURI = "http://localhost:" + super.port;
        tokenRepository.deleteAll();
        userRepository.deleteAll();
        doNothing().when(emailService).sendEmail(anyString(), anyLong(), anyBoolean());
    }

    private RequestRegister buildRequest(String username, String email, String password) {
        return new RequestRegister(username, email, password);
    }

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

    @Nested
    @DisplayName("POST /api/cognitum/auth/register")
    class Register {

        @Test
        @DisplayName("Should register a new user and return tokens and user info")
        void shouldRegisterNewUser() {
            RequestRegister request = buildRequest("testuser", "testuser@test.com", "password123");

            ResponseAuthentication response = registerUser(request);

            // Response fields
            assertThat(response.getAccessToken()).isNotBlank();
            assertThat(response.getRefreshToken()).isNotBlank();
            assertThat(response.getUserId()).isNotNull();
            assertThat(response.getUsername()).isEqualTo("testuser");
            assertThat(response.getEmail()).isEqualTo("testuser@test.com");
            assertThat(response.getIsActive()).isFalse(); // not confirmed yet

            // User was persisted
            assertThat(userRepository.findByEmail("testuser@test.com")).isPresent();

            // Token was persisted
            var savedUser = userRepository.findByEmail("testuser@test.com")
                    .orElseThrow(() -> new AssertionError("User not found in repository"));
            assertThat(tokenRepository.findAllByUserId(savedUser.getId())).hasSize(1);

            // Email confirmation was triggered
            verify(emailService, times(1)).sendEmail(
                    eq("testuser@test.com"), anyLong(), eq(false)
            );
        }

        @Test
        @DisplayName("Should return 409 when registering with an already existing email")
        void shouldReturnConflictForDuplicateEmail() {
            RequestRegister request = buildRequest("testuser", "testuser@test.com", "password123");
            registerUser(request); // first registration

            given()
                    .contentType(ContentType.JSON)
                    .body(request)
                    .when()
                    .post("/api/cognitum/auth/register")
                    .then()
                    .statusCode(409);
        }

        @Test
        @DisplayName("Should store a hashed password, not plaintext")
        void shouldHashPassword() {
            RequestRegister request = buildRequest("testuser", "testuser@test.com", "password123");
            registerUser(request);

            var savedUser = userRepository.findByEmail("testuser@test.com")
                    .orElseThrow(() -> new AssertionError("User not found in repository"));
            assertThat(savedUser.getPassword()).isNotEqualTo("password123");
            assertThat(savedUser.getPassword()).startsWith("$2"); // bcrypt prefix
        }

        @Test
        @DisplayName("Should set isActive to false on registration")
        void shouldSetUserInactiveOnRegistration() {
            RequestRegister request = buildRequest("testuser", "testuser@test.com", "password123");
            registerUser(request);

            var savedUser = userRepository.findByEmail("testuser@test.com")
                    .orElseThrow(() -> new AssertionError("User not found in repository"));
            assertThat(savedUser.getIsActive()).isFalse();
        }
    }

    @Nested
    @DisplayName("POST /api/cognitum/auth/authenticate")
    class Authenticate {

        @Test
        @DisplayName("Should authenticate a registered user and return new tokens")
        void shouldAuthenticateRegisteredUser() {
            RequestRegister registerRequest = buildRequest("testuser", "testuser@test.com", "password123");
            registerUser(registerRequest);

            given()
                    .contentType(ContentType.JSON)
                    .body(new RequestAuthentication("testuser@test.com", "password123"))
                    .when()
                    .post("/api/cognitum/auth/authenticate")
                    .then()
                    .statusCode(200)
                    .body("access_token", notNullValue())
                    .body("refresh_token", notNullValue())
                    .body("email", equalTo("testuser@test.com"))
                    .body("username", equalTo("testuser"))
                    .body("is_active", equalTo(false));
        }

        @Test
        @DisplayName("Should return 400 when authenticating with wrong password")
        void shouldReturnBadRequestForWrongPassword() {
            RequestRegister registerRequest = buildRequest("testuser", "testuser@test.com", "password123");
            registerUser(registerRequest);

            given()
                    .contentType(ContentType.JSON)
                    .body(new RequestAuthentication("testuser@test.com", "wrongpassword"))
                    .when()
                    .post("/api/cognitum/auth/authenticate")
                    .then()
                    .statusCode(400);
        }

        @Test
        @DisplayName("Should return 404 when authenticating a non-existent user")
        void shouldReturnNotFoundForUnknownUser() {
            given()
                    .contentType(ContentType.JSON)
                    .body(new RequestAuthentication("nobody@test.com", "password123"))
                    .when()
                    .post("/api/cognitum/auth/authenticate")
                    .then()
                    .statusCode(404);
        }

        @Test
        @DisplayName("Should revoke old tokens and issue new ones on re-authentication")
        void shouldRevokeOldTokensOnReAuthentication() {
            RequestRegister registerRequest = buildRequest("testuser", "testuser@test.com", "password123");
            registerUser(registerRequest);

            // Authenticate twice
            given()
                    .contentType(ContentType.JSON)
                    .body(new RequestAuthentication("testuser@test.com", "password123"))
                    .when()
                    .post("/api/cognitum/auth/authenticate")
                    .then()
                    .statusCode(200);

            given()
                    .contentType(ContentType.JSON)
                    .body(new RequestAuthentication("testuser@test.com", "password123"))
                    .when()
                    .post("/api/cognitum/auth/authenticate")
                    .then()
                    .statusCode(200);

            var savedUser = userRepository.findByEmail("testuser@test.com")
                    .orElseThrow(() -> new AssertionError("User not found in repository"));
            var tokens = tokenRepository.findAllByUserId(savedUser.getId());

            // All previous tokens should be revoked, only latest is active
            long activeTokens = tokens.stream()
                    .filter(t -> !t.getExpired() && !t.getRevoked())
                    .count();
            assertThat(activeTokens).isEqualTo(1);
        }
    }

    @Nested
    @DisplayName("POST /api/cognitum/auth/confirm")
    class ConfirmUser {

        @Test
        @DisplayName("Should activate user when correct confirmation code is provided")
        void shouldActivateUserWithCorrectCode() {
            RequestRegister registerRequest = buildRequest("testuser", "testuser@test.com", "password123");
            registerUser(registerRequest);

            var savedUser = userRepository.findByEmail("testuser@test.com")
                    .orElseThrow(() -> new AssertionError("User not found in repository"));
            Long code = savedUser.getCode();

            given()
                    .contentType(ContentType.JSON)
                    .body(new RequestConfirmation("testuser@test.com", code))
                    .when()
                    .post("/api/cognitum/auth/confirm")
                    .then()
                    .statusCode(200)
                    .body("success", equalTo(true));

            var confirmedUser = userRepository.findByEmail("testuser@test.com")
                    .orElseThrow(() -> new AssertionError("User not found in repository"));
            assertThat(confirmedUser.getIsActive()).isTrue();
        }

        @Test
        @DisplayName("Should not activate user when wrong confirmation code is provided")
        void shouldNotActivateUserWithWrongCode() {
            RequestRegister registerRequest = buildRequest("testuser", "testuser@test.com", "password123");
            registerUser(registerRequest);

            given()
                    .contentType(ContentType.JSON)
                    .body(new com.cognitum.backend.dto.request.RequestConfirmation("testuser@test.com", 0L))
                    .when()
                    .post("/api/cognitum/auth/confirm")
                    .then()
                    .statusCode(200);

            var user = userRepository.findByEmail("testuser@test.com")
                    .orElseThrow(() -> new AssertionError("User not found in repository"));
            assertThat(user.getIsActive()).isFalse();
        }
    }

}
