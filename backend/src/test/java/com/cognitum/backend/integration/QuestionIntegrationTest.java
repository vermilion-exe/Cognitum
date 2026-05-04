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
import java.util.UUID;

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

    private ResponseNote getNote(String accessToken, RequestNote requestNote) {
        return given()
                .header("Authorization", "Bearer " + accessToken)
                .contentType(ContentType.JSON)
                .body(requestNote)
                .when()
                .post("/api/cognitum/note")
                .then()
                .statusCode(200)
                .extract()
                .as(ResponseNote.class);
    }

    private List<ResponseFlashcard> generateFlashcards(String accessToken, String markdown) {
        int maxAttempts = 3;
        long delayMs = 15000;

        RuntimeException lastException = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return given()
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(ContentType.JSON)
                        .queryParam("markdown", markdown)
                        .queryParam("count", 5)
                        .when()
                        .post("/api/cognitum/question/flashcards")
                        .then()
                        .statusCode(200)
                        .extract()
                        .as(new TypeRef<List<ResponseFlashcard>>() {});
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

    private void createFlashcards(String accessToken, List<ResponseFlashcard> flashcards) {
        given()
                .header("Authorization", "Bearer " + accessToken)
                .contentType(ContentType.JSON)
                .body(flashcards)
                .post("/api/cognitum/question")
                .then()
                .statusCode(200);
    }

    private List<ResponseFlashcard> getFlashcardsByNoteId(String accessToken, Long noteId) {
        return given()
                .header("Authorization", "Bearer " + accessToken)
                .contentType(ContentType.JSON)
                .get("/api/cognitum/question/flashcards?noteId=" + noteId)
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
        flashcardRepository.deleteAll();
        noteRepository.deleteAll();
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

            ResponseNote note = getNote(auth.getAccessToken(), noteRequest);

            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .post("/api/cognitum/question/flashcards?markdown=" + note.getText() + "&count=5")
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

            ResponseNote note = getNote(auth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            List<ResponseFlashcard> flashcards = generateFlashcards(auth.getAccessToken(), note.getText());

            // Modify the note content
            String modifiedMarkdown = "Main principles of economics";

            // Get the irrelevant flashcard IDs
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(flashcards)
                    .get("/api/cognitum/question/relevance?markdown=" + modifiedMarkdown)
                    .then()
                    .statusCode(200)
                    .body(notNullValue());
        }

        @Test
        @DisplayName("Should return no irrelevant flashcards for a note")
        void shouldReturnNoIrrelevantFlashcardsForANote() {
            // Create a note first
            RequestNote noteRequest = new RequestNote(null, "SOLID principles", "testnote", null, null);

            ResponseNote note = getNote(auth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            List<ResponseFlashcard> flashcards = generateFlashcards(auth.getAccessToken(), note.getText());

            // Get the irrelevant flashcard IDs for unmodified note
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(flashcards)
                    .get("/api/cognitum/question/relevance?markdown=" + note.getText())
                    .then()
                    .statusCode(200)
                    .body("$", empty());
        }

    }

    @Nested
    @DisplayName("POST /api/cognitum/question")
    class FlashcardCreationTests {

        @Test
        @DisplayName("Should create flashcards for a note")
        void shouldCreateFlashcardsForANote() {
            // Create a note first
            RequestNote noteRequest = new RequestNote(null, "SOLID principles", "testnote", null, null);

            ResponseNote note = getNote(auth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            List<ResponseFlashcard> flashcards = generateFlashcards(auth.getAccessToken(), note.getText());

            flashcards.forEach(fc -> fc.setNoteId(note.getId()));

            // Create flashcards
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(flashcards)
                    .post("/api/cognitum/question")
                    .then()
                    .statusCode(200)
                    .body("success", equalTo(true));
        }

        @Test
        @DisplayName("Should return 400 when noteId is missing in flashcard")
        void shouldReturn400WhenNoteIdIsMissingInFlashcard() {
            // Create a note first
            RequestNote noteRequest = new RequestNote(null, "SOLID principles", "testnote", null, null);

            ResponseNote note = getNote(auth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            List<ResponseFlashcard> flashcards = generateFlashcards(auth.getAccessToken(), note.getText());

            // Try to create flashcards without setting noteId
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(flashcards)
                    .post("/api/cognitum/question")
                    .then()
                    .statusCode(400);
        }

        @Test
        @DisplayName("Should return 404 when non-existent noteId provided in flashcard")
        void shouldReturn404WhenNonExistentNoteIdProvidedInFlashcard() {
            // Generate flashcards for a non-existent note
            List<ResponseFlashcard> flashcards = generateFlashcards(auth.getAccessToken(), "SOLID principles");

            flashcards.forEach(fc -> fc.setNoteId(9999L));

            // Try to create flashcards with non-existent noteId
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(flashcards)
                    .post("/api/cognitum/question")
                    .then()
                    .statusCode(404);
        }

        @Test
        @DisplayName("Should return 401 when unowned noteId provided in flashcard")
        void shouldReturn401WhenUnownedNoteIdProvidedInFlashcard() {
            // Create another user
            RequestRegister otherUserRequest = new RequestRegister("otheruser", "otheruser@test.com", "otherpassword123");
            ResponseAuthentication otherAuth = registerUser(otherUserRequest);
            User otherUser = userRepository.findByEmail(otherUserRequest.getEmail()).orElseThrow(() -> new RuntimeException("user not found."));
            otherUser.setIsActive(true);
            userRepository.save(otherUser);

            // Create a note for that user
            RequestNote noteRequest = new RequestNote(null, "SOLID principles", "testnote", null, null);

            ResponseNote note = getNote(otherAuth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            List<ResponseFlashcard> flashcards = generateFlashcards(otherAuth.getAccessToken(), note.getText());

            flashcards.forEach(fc -> fc.setNoteId(note.getId()));

            // Try to create flashcards with unowned noteId
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(flashcards)
                    .post("/api/cognitum/question")
                    .then()
                    .statusCode(401);
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

            ResponseNote note = getNote(auth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            List<ResponseFlashcard> flashcards = generateFlashcards(auth.getAccessToken(), note.getText());

            flashcards.forEach(fc -> fc.setNoteId(note.getId()));

            createFlashcards(auth.getAccessToken(), flashcards);

            ResponseFlashcard createdFlashcard = getFlashcardsByNoteId(auth.getAccessToken(), note.getId()).get(0);

            createdFlashcard.setEasinessFactor(2.5);
            createdFlashcard.setInterval(1);
            createdFlashcard.setRepetitions(1);
            createdFlashcard.setNextReview(LocalDate.now().plusDays(1));

            // Submit the flashcard review
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(createdFlashcard)
                    .post("/api/cognitum/question/review")
                    .then()
                    .statusCode(200)
                    .body("success", equalTo(true));
        }

        @Test
        @DisplayName("Should return 404 for non-existent flashcard")
        void shouldReturn404ForNonExistentFlashcard() {
            ResponseFlashcard flashcard = new ResponseFlashcard(UUID.randomUUID(), null, null, null, false, false, 1.0, 1, 1, null, null, null);
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

            ResponseNote note = getNote(otherAuth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            List<ResponseFlashcard> flashcards = generateFlashcards(otherAuth.getAccessToken(), note.getText());

            flashcards.forEach(fc -> fc.setNoteId(note.getId()));

            createFlashcards(otherAuth.getAccessToken(), flashcards);

            ResponseFlashcard otherUserFlashcard = getFlashcardsByNoteId(otherAuth.getAccessToken(), note.getId()).get(0);

            // Submit the flashcard review with the current user
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(otherUserFlashcard)
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

            ResponseNote note = getNote(auth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            List<ResponseFlashcard> flashcards = generateFlashcards(auth.getAccessToken(), note.getText());

            flashcards.forEach(fc -> fc.setNoteId(note.getId()));

            createFlashcards(auth.getAccessToken(), flashcards);

            // Get the  flashcards for the note
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .get("/api/cognitum/question/flashcards?noteId=" + note.getId())
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

            ResponseNote note = getNote(otherAuth.getAccessToken(), noteRequest);

            // Try to access the note flashcards with current user
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .get("/api/cognitum/question/flashcards?noteId=" + note.getId())
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

            ResponseNote note = getNote(auth.getAccessToken(), noteRequest);

            // Generate flashcards for the note
            List<ResponseFlashcard> flashcards = generateFlashcards(auth.getAccessToken(), note.getText());

            // Modify the note content
            RequestNote updateNote = new RequestNote(note.getId(), "Main principles of economics", "testnote", null, null);

            getNote(auth.getAccessToken(), updateNote);

            // Get the irrelevant flashcard IDs
            List<UUID> flashcardIds = given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(flashcards)
                    .get("/api/cognitum/question/relevance?markdown=" + note.getText())
                    .then()
                    .statusCode(200)
                    .extract()
                    .as(new TypeRef<List<UUID>>() {});

            // Remove the irrelevant flashcards
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .delete("/api/cognitum/question/flashcards/stale?noteId=" + note.getId())
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

            ResponseNote note = getNote(otherAuth.getAccessToken(), noteRequest);

            // Try to delete the note flashcards with current user
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .delete("/api/cognitum/question/flashcards/stale?noteId=" + note.getId())
                    .then()
                    .statusCode(401);
        }

    }

}
