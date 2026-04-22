package com.cognitum.backend.integration;

import com.cognitum.backend.dto.request.RequestNote;
import com.cognitum.backend.dto.request.RequestRegister;
import com.cognitum.backend.dto.response.ResponseAuthentication;
import com.cognitum.backend.dto.response.ResponseFlashcard;
import com.cognitum.backend.dto.response.ResponseNote;
import com.cognitum.backend.entity.User;
import com.cognitum.backend.repository.FlashcardRepository;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.repository.TokenRepository;
import com.cognitum.backend.repository.UserRepository;
import com.cognitum.backend.service.EmailService;
import io.restassured.RestAssured;
import io.restassured.common.mapper.TypeRef;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDate;
import java.util.List;

import static io.restassured.RestAssured.given;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doNothing;

public class QuestionIntegrationTest  extends BaseIntegrationTest {

    @Autowired
    private FlashcardRepository flashcardRepository;

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

    private List<ResponseFlashcard> getFlashcards(String accessToken, Long noteId) {
        return given()
                .header("Authorization", "Bearer " +accessToken)
                .contentType(ContentType.JSON)
                .post("/api/cognitum/question/flashcards?noteId=" + noteId + "&count=5")
                .then()
                .statusCode(200)
                .extract()
                .as(new TypeRef<List<ResponseFlashcard>>() {});
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

    @BeforeEach
    void setUp() {
        RestAssured.baseURI = "http://localhost:" + super.port;
        tokenRepository.deleteAll();
        userRepository.deleteAll();
        getUser();
        noteRepository.deleteAll();
        flashcardRepository.deleteAll();
        doNothing().when(emailService).sendEmail(anyString(), anyLong(), anyBoolean());
    }

    @Nested
    @DisplayName("POST /api/cognitum/question/flashcards")
    class FlashcardGenerationTests {

        @Test
        @DisplayName("Should return flashcards for a note")
        void shouldReturnFlashcardsForANote() {
            // Create a note first
            RequestNote noteRequest = new RequestNote(null, "SOLID principles", "testnote", null, null);

            Long noteId = getNote(auth.getAccessToken(), noteRequest);

            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .post("/api/cognitum/question/flashcards?noteId=" + noteId + "&count=5")
                    .then()
                    .statusCode(200)
                    .body(notNullValue());
        }

    }

    @Nested
    @DisplayName("POST /api/cognitum/question/relevance")
    class FlashcardRelevanceTests {

        @Test
        @DisplayName("Should return irrelevant flashcards for a note")
        void shouldReturnIrrelevantFlashcardsForANote() {
            // Create a note first
            RequestNote noteRequest = new RequestNote(null, "SOLID principles", "testnote", null, null);

            Long noteId = getNote(auth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            getFlashcards(auth.getAccessToken(), noteId);

            // Modify the note content
            RequestNote updateNote = new RequestNote(noteId, "Main principles of economics", "testnote", null, null);

            getNote(auth.getAccessToken(), updateNote);

            // Get the irrelevant flashcard IDs
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .get("/api/cognitum/question/relevance?noteId=" + noteId)
                    .then()
                    .statusCode(200)
                    .body(notNullValue());
        }

        @Test
        @DisplayName("Should return no irrelevant flashcards for a note")
        void shouldReturnNoIrrelevantFlashcardsForANote() {
            // Create a note first
            RequestNote noteRequest = new RequestNote(null, "SOLID principles", "testnote", null, null);

            Long noteId = getNote(auth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            getFlashcards(auth.getAccessToken(), noteId);

            // Get the irrelevant flashcard IDs for unmodified note
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .get("/api/cognitum/question/relevance?noteId=" + noteId)
                    .then()
                    .statusCode(200)
                    .body("$", empty());
        }

    }

    @Nested
    @DisplayName("POST /api/cognitum/question/review")
    class FlashcardReviewTests {

        @Test
        @DisplayName("Should submit review for flashcard")
        void shouldSubmitReviewForFlashcard() {
            // Create a note first
            RequestNote noteRequest = new RequestNote(null, "SOLID principles", "testnote", null, null);

            Long noteId = getNote(auth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            ResponseFlashcard flashcard = getFlashcards(auth.getAccessToken(), noteId).get(0);

            flashcard.setEasinessFactor(2.5);
            flashcard.setInterval(1);
            flashcard.setRepetitions(1);
            flashcard.setNextReview(LocalDate.now().plusDays(1));

            // Submit the flashcard review
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(flashcard)
                    .post("/api/cognitum/question/review")
                    .then()
                    .statusCode(200)
                    .body("success", equalTo(true));
        }

        @Test
        @DisplayName("Should return 404 for non-existent flashcard")
        void shouldReturn404ForNonExistentFlashcard() {
            ResponseFlashcard flashcard = new ResponseFlashcard(9999L, null, null, null, false, false, 1.0, 1, 1, null, null, null);
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(flashcard)
                    .post("/api/cognitum/question/review")
                    .then()
                    .statusCode(404);
        }

        @Test
        @DisplayName("Should return 401 when unowned flashcard is reviewed")
        void shouldReturn401WhenUnownedFlashcardIsReviewed() {
            // Create another user
            RequestRegister otherUserRequest = new RequestRegister("otheruser", "otheruser@test.com", "otherpassword123");
            ResponseAuthentication otherAuth = registerUser(otherUserRequest);
            User otherUser = userRepository.findByEmail(otherUserRequest.getEmail()).orElseThrow(() -> new RuntimeException("user not found."));
            otherUser.setIsActive(true);
            userRepository.save(otherUser);

            // Create a note for that user
            RequestNote noteRequest = new RequestNote(null, "SOLID principles", "testnote", null, null);

            Long noteId = getNote(otherAuth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            ResponseFlashcard flashcard = getFlashcards(otherAuth.getAccessToken(), noteId).get(0);

            // Submit the flashcard review with the current user
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(flashcard)
                    .post("/api/cognitum/question/review")
                    .then()
                    .statusCode(401);
        }

    }

    @Nested
    @DisplayName("GET /api/cognitum/question/flashcards")
    class GetNoteFlashcardsTests {

        @Test
        @DisplayName("Should return given note flashcards")
        void shouldReturnGivenNoteFlashcards() {
            // Create a note first
            RequestNote noteRequest = new RequestNote(null, "SOLID principles", "testnote", null, null);

            Long noteId = getNote(auth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            getFlashcards(auth.getAccessToken(), noteId);

            // Get the  flashcards for the note
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .get("/api/cognitum/question/flashcards?noteId=" + noteId)
                    .then()
                    .statusCode(200)
                    .body(notNullValue());
        }

        @Test
        @DisplayName("Should return 404 for non-existent note")
        void shouldReturn404ForNonExistentNote() {
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .get("/api/cognitum/question/flashcards?noteId=" + 9999L)
                    .then()
                    .statusCode(404);
        }

        @Test
        @DisplayName("Should return 401 when unowned flashcards accessed")
        void shouldReturn401WhenUnownedFlashcardsAccessed() {
            // Create another user
            RequestRegister otherUserRequest = new RequestRegister("otheruser", "otheruser@test.com", "otherpassword123");
            ResponseAuthentication otherAuth = registerUser(otherUserRequest);
            User otherUser = userRepository.findByEmail(otherUserRequest.getEmail()).orElseThrow(() -> new RuntimeException("user not found."));
            otherUser.setIsActive(true);
            userRepository.save(otherUser);

            // Create a note for that user
            RequestNote noteRequest = new RequestNote(null, "SOLID principles", "testnote", null, null);

            Long noteId = getNote(otherAuth.getAccessToken(), noteRequest);

            // Try to access the note flashcards with current user
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .get("/api/cognitum/question/flashcards?noteId=" + noteId)
                    .then()
                    .statusCode(401);
        }

    }

    @Nested
    @DisplayName("DELETE /api/cognitum/question/flashards/stale")
    class DeleteStaleFlashcardsTests {

        @Test
        @DisplayName("Should delete stale flashcards")
        void shouldDeleteStaleFlashcards() {
            // Create a note first
            RequestNote noteRequest = new RequestNote(null, "SOLID principles", "testnote", null, null);

            Long noteId = getNote(auth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            getFlashcards(auth.getAccessToken(), noteId);

            // Modify the note content
            RequestNote updateNote = new RequestNote(noteId, "Main principles of economics", "testnote", null, null);

            getNote(auth.getAccessToken(), updateNote);

            // Get the irrelevant flashcard IDs
            List<Long> flashcardIds = given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .get("/api/cognitum/question/relevance?noteId=" + noteId)
                    .then()
                    .statusCode(200)
                    .extract()
                    .as(new TypeRef<List<Long>>() {});

            // Remove the irrelevant flashcards
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .delete("/api/cognitum/question/flashcards/stale?noteId=" + noteId)
                    .then()
                    .statusCode(200)
                    .body("success", equalTo(true));

            assertEquals(flashcardRepository.findAllById(flashcardIds).size(), 0);
        }

        @Test
        @DisplayName("Should return 404 when non-existent note provided")
        void shouldReturn404WhenNonExistentNoteProvided() {
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .delete("/api/cognitum/question/flashcards/stale?noteId=" + 9999L)
                    .then()
                    .statusCode(404);
        }

        @Test
        @DisplayName("Should return 401 when unowned flashcards deleted")
        void shouldReturn401WhenUnownedFlashcardsDeleted() {
            // Create another user
            RequestRegister otherUserRequest = new RequestRegister("otheruser", "otheruser@test.com", "otherpassword123");
            ResponseAuthentication otherAuth = registerUser(otherUserRequest);
            User otherUser = userRepository.findByEmail(otherUserRequest.getEmail()).orElseThrow(() -> new RuntimeException("user not found."));
            otherUser.setIsActive(true);
            userRepository.save(otherUser);

            // Create a note for that user
            RequestNote noteRequest = new RequestNote(null, "SOLID principles", "testnote", null, null);

            Long noteId = getNote(otherAuth.getAccessToken(), noteRequest);

            // Try to delete the note flashcards with current user
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .delete("/api/cognitum/question/flashcards/stale?noteId=" + noteId)
                    .then()
                    .statusCode(401);
        }

    }

}
