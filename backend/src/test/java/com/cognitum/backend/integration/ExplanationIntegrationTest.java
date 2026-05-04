package com.cognitum.backend.integration;

import com.cognitum.backend.dto.request.RequestHighlight;
import com.cognitum.backend.dto.request.RequestNote;
import com.cognitum.backend.dto.request.RequestRegister;
import com.cognitum.backend.dto.response.ResponseAuthentication;
import com.cognitum.backend.dto.response.ResponseCompletion;
import com.cognitum.backend.dto.response.ResponseNote;
import com.cognitum.backend.entity.User;
import com.cognitum.backend.repository.ExplanationRepository;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.repository.TokenRepository;
import com.cognitum.backend.repository.UserRepository;
import com.cognitum.backend.service.EmailService;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doNothing;

public class ExplanationIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private ExplanationRepository explanationRepository;

    @Autowired
    private NoteRepository noteRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TokenRepository tokenRepository;

    @MockitoBean
    private EmailService emailService;

    private static ResponseAuthentication auth;

    private ResponseAuthentication registerUser(RequestRegister request) {
        return given()
                .contentType(ContentType.JSON)
                .body(request)
                .when()
                .post("/api/cognitum/auth/register")
                .then()
                .statusCode(200)
                .extract()
                .as(ResponseAuthentication.class);
    }

    private void getUser() {
        if (userRepository.findByEmail("testuser@test.com").isEmpty()) {
            RequestRegister request = new RequestRegister("testuser", "testuser@test.com", "password123");
            auth = registerUser(request);
            User newUser = userRepository.findByEmail("testuser@test.com").orElseThrow(() -> new RuntimeException("User not found after registration"));
            newUser.setIsActive(true);
            userRepository.save(newUser);
        }
    }

    private Long getNote(String accessToken, RequestNote requestNote) {
        return given()
                .header("Authorization", "Bearer " + accessToken)
                .contentType(ContentType.JSON)
                .body(requestNote)
                .when()
                .post("/api/cognitum/note")
                .then()
                .statusCode(200)
                .extract()
                .as(ResponseNote.class)
                .getId();
    }

    private String explainText(String token, String text) {
        int maxAttempts = 3;
        long delayMs = 15000;

        RuntimeException lastException = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return given()
                        .header("Authorization", "Bearer " + token)
                        .contentType(ContentType.JSON)
                        .body(text)
                        .when()
                        .post("/api/cognitum/explanation/explain")
                        .then()
                        .statusCode(200)
                        .extract()
                        .response()
                        .as(ResponseCompletion.class)
                        .getChoices()
                        .get(0)
                        .getMessage()
                        .getContent();
            } catch (RuntimeException e) {
                lastException = e;

                if (attempt == maxAttempts) {
                    throw e;
                }

                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException interruptedException) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Retry interrupted", interruptedException);
                }
            }
        }

        throw lastException;
    }

    private void createExplanation(String token, RequestHighlight requestHighlight) {
        given()
                .header("Authorization", "Bearer " + token)
                .contentType(ContentType.JSON)
                .body(requestHighlight)
                .when()
                .post("/api/cognitum/explanation")
                .then()
                .statusCode(200);
    }

    @BeforeEach
    void setUp() {
        RestAssured.baseURI = "http://localhost:" + super.port;
        tokenRepository.deleteAll();
        userRepository.deleteAll();
        getUser();
        explanationRepository.deleteAll();
        noteRepository.deleteAll();
        doNothing().when(emailService).sendEmail(anyString(), anyLong(), anyBoolean());
    }

    @Nested
    @DisplayName("POST /api/cognitum/explanation/explain")
    class ExplanationTests {

        @Test
        @DisplayName("Should explain successfully")
        void shouldExplainSuccessfully() {
            String text = "Explain SOLID principles";

           given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(text)
                    .when()
                    .post("/api/cognitum/explanation/explain")
                   .then()
                   .statusCode(200);
        }

    }

    @Nested
    @DisplayName("POST /api/cognitum/explanation")
    class CreateExplanationTests {

        @Test
        @DisplayName("Should create explanation successfully")
        void shouldCreateExplanationSuccessfully() {
            // Create a note first
            RequestNote noteRequest = new RequestNote(null, "explain SOLID principles", "testnote", null, null);

            Long noteId = getNote(auth.getAccessToken(), noteRequest);

            // Explain its contents
            String explanation = explainText(auth.getAccessToken(), noteRequest.getText());

            // Save the explanation as a highlight
            UUID id = UUID.randomUUID();
            RequestHighlight requestHighlight = new RequestHighlight(id, noteRequest.getText(), explanation, 0, noteRequest.getText().length(), null, noteId);

            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(requestHighlight)
                    .when()
                    .post("/api/cognitum/explanation")
                    .then()
                    .statusCode(200)
                    .body("id", notNullValue());
        }

        @Test
        @DisplayName("Should update explanation successfully")
        void shouldUpdateExplanationSuccessfully() {
            // Create a note first
            RequestNote noteRequest = new RequestNote(null, "explain SOLID principles", "testnote", null, null);

            Long noteId = getNote(auth.getAccessToken(), noteRequest);

            // Explain its contents
            String explanation = explainText(auth.getAccessToken(), noteRequest.getText());

            // Save the explanation as a highlight
            UUID id = UUID.randomUUID();
            RequestHighlight requestHighlight = new RequestHighlight(id, noteRequest.getText(), explanation, 0, noteRequest.getText().length(), null, noteId);

            createExplanation(auth.getAccessToken(), requestHighlight);

            RequestHighlight updateHighlight = new RequestHighlight(id, noteRequest.getText(), "Updated Explanation", 0, noteRequest.getText().length(), null, noteId);

            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(updateHighlight)
                    .when()
                    .post("/api/cognitum/explanation")
                    .then()
                    .statusCode(200)
                    .body("explanation", equalTo("Updated Explanation"));
        }

        @Test
        @DisplayName("Should return 401 when unowned explanation is updated")
        void shouldReturn401WhenUnownedExplanationIsUpdated() {
            RequestRegister otherUserRequest = new RequestRegister("otheruser", "otheruser@test.com", "otherpassword123");
            ResponseAuthentication otherAuth = registerUser(otherUserRequest);
            User otherUser = userRepository.findByEmail(otherUserRequest.getEmail()).orElseThrow(() -> new RuntimeException("user not found."));
            otherUser.setIsActive(true);
            userRepository.save(otherUser);

            // Create a note by another user
            RequestNote noteRequest = new RequestNote(null, "explain SOLID principles", "testnote", null, null);

            Long noteId = getNote(otherAuth.getAccessToken(), noteRequest);

            // Explain its contents
            String explanation = explainText(auth.getAccessToken(), noteRequest.getText());

            // Save the explanation as a highlight
            UUID id = UUID.randomUUID();
            RequestHighlight requestHighlight = new RequestHighlight(id, noteRequest.getText(), explanation, 0, noteRequest.getText().length(), null, noteId);

            createExplanation(otherAuth.getAccessToken(), requestHighlight);

            RequestHighlight updateHighlight = new RequestHighlight(id, noteRequest.getText(), explanation, 0, noteRequest.getText().length(), null, noteId);

            // Try to access the explanations with the current user
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(updateHighlight)
                    .when()
                    .post("/api/cognitum/explanation")
                    .then()
                    .statusCode(401);
        }

    }

    @Nested
    @DisplayName("GET /api/cognitum/explanation/note")
    class getExplanationsByNoteIdTests {

        @Test
        @DisplayName("Should return explanations for valid noteId")
        void shouldReturnExplanationsForValidNoteId() {
            // Create a note first
            RequestNote noteRequest = new RequestNote(null, "explain SOLID principles", "testnote", null, null);

            Long noteId = getNote(auth.getAccessToken(), noteRequest);

            // Explain its contents
            String explanation = explainText(auth.getAccessToken(), noteRequest.getText());

            // Save the explanation as a highlight
            UUID id = UUID.randomUUID();
            RequestHighlight requestHighlight = new RequestHighlight(id, noteRequest.getText(), explanation, 0, noteRequest.getText().length(), null, noteId);

            createExplanation(auth.getAccessToken(), requestHighlight);

            // Get the highlight by note id
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .when()
                    .get("/api/cognitum/explanation/note?noteId=" + noteId)
                    .then()
                    .statusCode(200)
                    .body("[0].id", notNullValue());
        }

        @Test
        @DisplayName("Should return 404 for non-existent noteId")
        void shouldReturn404ForNonExistentNoteId() {
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .when()
                    .get("/api/cognitum/explanation/note?noteId=99999")
                    .then()
                    .statusCode(404);
        }

        @Test
        @DisplayName("Should return 401 when unowned explanation is accessed")
        void shouldReturn401WhenUnownedExplanationIsAccessed() {
            RequestRegister otherUserRequest = new RequestRegister("otheruser", "otheruser@test.com", "otherpassword123");
            ResponseAuthentication otherAuth = registerUser(otherUserRequest);
            User otherUser = userRepository.findByEmail(otherUserRequest.getEmail()).orElseThrow(() -> new RuntimeException("user not found."));
            otherUser.setIsActive(true);
            userRepository.save(otherUser);

            // Create a note by another user
            RequestNote noteRequest = new RequestNote(null, "explain SOLID principles", "testnote", null, null);

            Long noteId = getNote(otherAuth.getAccessToken(), noteRequest);

            // Explain its contents
            String explanation = explainText(otherAuth.getAccessToken(), noteRequest.getText());

            // Save the explanation as a highlight
            UUID id = UUID.randomUUID();
            RequestHighlight requestHighlight = new RequestHighlight(id, noteRequest.getText(), explanation, 0, noteRequest.getText().length(), null, noteId);

            createExplanation(otherAuth.getAccessToken(), requestHighlight);

            // Try to access the explanations with the current user
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .when()
                    .get("/api/cognitum/explanation/note?noteId=" + noteId)
                    .then()
                    .statusCode(401);
        }

    }

}
