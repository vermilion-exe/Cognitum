package com.cognitum.backend.integration;

import com.cognitum.backend.dto.request.RequestNote;
import com.cognitum.backend.dto.request.RequestRegister;
import com.cognitum.backend.dto.request.RequestSummary;
import com.cognitum.backend.dto.response.ResponseAuthentication;
import com.cognitum.backend.dto.response.ResponseSummary;
import com.cognitum.backend.entity.User;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.repository.SummaryRepository;
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

import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doNothing;

public class SummaryIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private SummaryRepository summaryRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NoteRepository noteRepository;

    @MockitoBean
    private EmailService emailService;

    private static ResponseAuthentication auth;

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
        Response createResponse = given()
                .header("Authorization", "Bearer " + accessToken)
                .contentType(ContentType.JSON)
                .body(requestNote)
                .when()
                .post("/api/cognitum/note")
                .then()
                .statusCode(200)
                .extract()
                .response();

        return createResponse.jsonPath().getLong("id");
    }

    @BeforeEach
    void setUp() {
        RestAssured.baseURI = "http://localhost:" + super.port;
        getUser();
        noteRepository.deleteAll();
        summaryRepository.deleteAll();
        doNothing().when(emailService).sendEmail(anyString(), anyLong(), anyBoolean());
    }

    @Nested
    @DisplayName("POST /api/cognitum/summary/summarize")
    class SummarizeTests {

        @Test
        @DisplayName("Should summarize successfully")
        void shouldSummarizeSuccessfully() {
            String token = auth.getAccessToken();
            RequestSummary requestSummary = new RequestSummary("This is a summary.", 1024, true);

            given()
                    .header("Authorization", "Bearer " + token)
                    .contentType(ContentType.JSON)
                    .body(requestSummary)
                    .when()
                    .post("/api/cognitum/summary/summarize")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("summary", notNullValue());
        }

    }

    @Nested
    @DisplayName("POST /api/cognitum/summary")
    class CreateSummaryTests {

        @Test
        @DisplayName("Should create summary successfully")
        void shouldCreateSummarySuccessfully() {
            String token = auth.getAccessToken();
            RequestNote noteRequest = new RequestNote(null, "Original content.", "testnote", null, null);

            Long noteId = getNote(token, noteRequest);

            ResponseSummary request = new ResponseSummary(null, "This is a saved summary", noteId);

            given()
                    .header("Authorization", "Bearer " + token)
                    .contentType(ContentType.JSON)
                    .body(request)
                    .when()
                    .post("/api/cognitum/summary")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("id", notNullValue());
        }

        @Test
        @DisplayName("Should return 401 when unowned summary is updated")
        void shouldReturn401WhenUnownedSummaryIsUpdated() {
            // Create a note with another user
            RequestRegister otherUserRequest = new RequestRegister("otheruser", "otheruser2@test.com", "otherpassword123");
            ResponseAuthentication otherAuth = registerUser(otherUserRequest);
            User otherUser = userRepository.findByEmail(otherUserRequest.getEmail()).orElseThrow(() -> new RuntimeException("user not found."));
            otherUser.setIsActive(true);
            userRepository.save(otherUser);

            RequestNote createRequest = new RequestNote(null, "Other user's note.", "othernote", null, null);

            Long noteId = getNote(otherAuth.getAccessToken(), createRequest);

            // Create a summary for that note
            RequestSummary requestSummary = new RequestSummary("This is a summary.", 1024, true);

            Response summaryResponse = given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(requestSummary)
                    .when()
                    .post("/api/cognitum/summary/summarize")
                    .then()
                    .statusCode(200)
                    .extract()
                    .response();

            String summary = summaryResponse.jsonPath().getString("summary");

            Response createResponse = given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(new ResponseSummary(null, summary, noteId))
                    .when()
                    .post("/api/cognitum/summary")
                    .then()
                    .statusCode(200)
                    .extract()
                    .response();

            String summaryId = createResponse.jsonPath().getString("id");

            ResponseSummary request = new ResponseSummary(UUID.fromString(summaryId), "This is a saved summary.", noteId);

            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(request)
                    .when()
                    .post("/api/cognitum/summary")
                    .then()
                    .statusCode(401);
        }

    }

    @Nested
    @DisplayName("GET /api/cognitum/summary/note")
    class GetSummaryByNoteIdTests {

        @Test
        @DisplayName("Should return summary for valid noteId")
        void shouldReturnSummaryForValidNoteId() {
            String token = auth.getAccessToken();
            RequestNote noteRequest = new RequestNote(null, "Original content.", "testnote", null, null);

            Long noteId = getNote(token, noteRequest);

            // Create a summary for that note
            RequestSummary requestSummary = new RequestSummary("This is a summary.", 1024, true);

            Response summaryResponse = given()
                    .header("Authorization", "Bearer " + token)
                    .contentType(ContentType.JSON)
                    .body(requestSummary)
                    .when()
                    .post("/api/cognitum/summary/summarize")
                    .then()
                    .statusCode(200)
                    .extract()
                    .response();

            String summary = summaryResponse.jsonPath().getString("summary");

            given()
                    .header("Authorization", "Bearer " + token)
                    .contentType(ContentType.JSON)
                    .body(new ResponseSummary(null, summary, noteId))
                    .when()
                    .post("/api/cognitum/summary")
                    .then()
                    .statusCode(200);

            Response response = given()
                    .header("Authorization", "Bearer " + token)
                    .when()
                    .get("/api/cognitum/summary/note?noteId=" + noteId);

            response.then().log().ifValidationFails();

            response.then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("summary", notNullValue());
        }

        @Test
        @DisplayName("Should return 404 for non-existent noteId")
        void shouldReturn404ForNonExistentNoteId() {
            String token = auth.getAccessToken();
            given()
                    .header("Authorization", "Bearer " + token)
                    .when()
                    .get("/api/cognitum/summary/note?noteId=99999")
                    .then()
                    .statusCode(404);
        }

        @Test
        @DisplayName("Should return 401 when unowned summary is accessed")
        void shouldReturn401WhenUnownedSummaryIsAccessed() {
            // Create a note with another user
            RequestRegister otherUserRequest = new RequestRegister("otheruser", "otheruser@test.com", "otherpassword123");
            ResponseAuthentication otherAuth = registerUser(otherUserRequest);
            User otherUser = userRepository.findByEmail(otherUserRequest.getEmail()).orElseThrow(() -> new RuntimeException("user not found."));
            otherUser.setIsActive(true);
            userRepository.save(otherUser);

            RequestNote createRequest = new RequestNote(null, "Other user's note.", "othernote", null, null);

            Long noteId = getNote(otherAuth.getAccessToken(), createRequest);

            // Create a summary for that note
            RequestSummary requestSummary = new RequestSummary("This is a summary.", 1024, true);

            Response summaryResponse = given()
                    .header("Authorization", "Bearer " + otherAuth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(requestSummary)
                    .when()
                    .post("/api/cognitum/summary/summarize")
                    .then()
                    .statusCode(200)
                    .extract()
                    .response();

            String summary = summaryResponse.jsonPath().getString("summary");

            given()
                    .header("Authorization", "Bearer " + otherAuth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(new ResponseSummary(null, summary, noteId))
                    .when()
                    .post("/api/cognitum/summary")
                    .then()
                    .statusCode(200);

            // Attempt to access the summary with the original user
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .when()
                    .get("/api/cognitum/summary/note?noteId=" + noteId)
                    .then()
                    .statusCode(401);
        }

    }

}
