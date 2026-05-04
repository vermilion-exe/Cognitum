package com.cognitum.backend.integration;

import com.cognitum.backend.dto.request.RequestNote;
import com.cognitum.backend.dto.request.RequestRegister;
import com.cognitum.backend.dto.response.ResponseAuthentication;
import com.cognitum.backend.entity.User;
import com.cognitum.backend.repository.NoteRepository;
import com.cognitum.backend.repository.TokenRepository;
import com.cognitum.backend.repository.UserRepository;
import com.cognitum.backend.service.EmailService;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doNothing;

public class NoteIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private NoteRepository noteRepository;

    @Autowired
    private TokenRepository tokenRepository;

    @Autowired
    private UserRepository userRepository;

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

    @BeforeEach
    void setUp() {
        RestAssured.baseURI = "http://localhost:" + super.port;
        tokenRepository.deleteAll();
        userRepository.deleteAll();
        getUser();
        noteRepository.deleteAll();
        doNothing().when(emailService).sendEmail(anyString(), anyLong(), anyBoolean());
    }

    @Nested
    @DisplayName("GET /api/cognitum/note")
    class GetNotes {

        @Test
        @DisplayName("should return empty list when no notes exist")
        void shouldReturnEmptyList() {
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .when()
                    .get("/api/cognitum/note")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("$", hasSize(0));
        }

        @Test
        @DisplayName("should return list of notes when notes exist")
        void shouldReturnListOfNotes() {
            RequestNote requestNote = new RequestNote(null, "This is a test note.", "testnote", null, null);

            // Create a note
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(requestNote)
                    .when()
                    .post("/api/cognitum/note")
                    .then()
                    .statusCode(200);

            // Get notes
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .when()
                    .get("/api/cognitum/note")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("$", hasSize(1))
                    .body("[0].path", equalTo("testnote"))
                    .body("[0].text", equalTo("This is a test note."));
        }

    }

    @Nested
    @DisplayName("POST /api/cognitum/note")
    class CreateNote {

        @Test
        @DisplayName("should create a new note")
        void shouldCreateNewNote() {
            RequestNote requestNote = new RequestNote(null, "This is a test note.", "testnote", null, null);

            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(requestNote)
                    .when()
                    .post("/api/cognitum/note")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("path", equalTo("testnote"))
                    .body("text", equalTo("This is a test note."));
        }

        @Test
        @DisplayName("should update existing note when id is provided")
        void shouldUpdateExistingNote() {
            // Create a note
            RequestNote createRequest = new RequestNote(null, "Original content.", "testnote", null, null);
            Response createResponse = given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(createRequest)
                    .when()
                    .post("/api/cognitum/note")
                    .then()
                    .statusCode(200)
                    .extract()
                    .response();

            Long noteId = createResponse.jsonPath().getLong("id");

            // Update the note
            RequestNote updateRequest = new RequestNote(noteId, "Updated content.", "testnote", null, null);
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(updateRequest)
                    .when()
                    .post("/api/cognitum/note")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("id", equalTo(noteId.intValue()))
                    .body("path", equalTo("testnote"))
                    .body("text", equalTo("Updated content."));
        }

        @Test
        @DisplayName("should update existing note with same path when id is omitted")
        void shouldUpdateExistingNoteWithSamePathWhenIdIsOmitted() {
            RequestNote createRequest = new RequestNote(null, "Original content.", "testnote", null, null);
            Response createResponse = given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(createRequest)
                    .when()
                    .post("/api/cognitum/note")
                    .then()
                    .statusCode(200)
                    .extract()
                    .response();

            Long noteId = createResponse.jsonPath().getLong("id");
            RequestNote updateRequest = new RequestNote(null, "Updated content.", "testnote", null, null);

            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(updateRequest)
                    .when()
                    .post("/api/cognitum/note")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("id", equalTo(noteId.intValue()))
                    .body("path", equalTo("testnote"))
                    .body("text", equalTo("Updated content."));

            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .when()
                    .get("/api/cognitum/note")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("$", hasSize(1));
        }

        @Test
        @DisplayName("should return 401 when unowned note is updated")
        void shouldReturn401ForUnownedNote() {
            // Create a note with another user
            RequestRegister otherUserRequest = new RequestRegister("otheruser", "otheruser@test.com", "otherpassword123");
            ResponseAuthentication otherAuth = registerUser(otherUserRequest);
            User otherUser = userRepository.findByEmail(otherUserRequest.getEmail()).orElseThrow(() -> new RuntimeException("user not found."));
            otherUser.setIsActive(true);
            userRepository.save(otherUser);

            RequestNote createRequest = new RequestNote(null, "Other user's note.", "othernote", null, null);
            Response createResponse = given()
                    .header("Authorization", "Bearer " + otherAuth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(createRequest)
                    .when()
                    .post("/api/cognitum/note")
                    .then()
                    .statusCode(200)
                    .extract()
                    .response();

            Long noteId = createResponse.jsonPath().getLong("id");

            // Attempt to update the note with the original user
            RequestNote updateRequest = new RequestNote(noteId, "Attempted update.", "othernote", null, null);
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(updateRequest)
                    .when()
                    .post("/api/cognitum/note")
                    .then()
                    .statusCode(401);
        }

        @Test
        @DisplayName("should return 404 when updating non-existent note")
        void shouldReturn404ForNonExistentNote() {
            RequestNote updateRequest = new RequestNote(999L, "Non-existent note.", "nonexistent", null, null);
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(updateRequest)
                    .when()
                    .post("/api/cognitum/note")
                    .then()
                    .statusCode(404);
        }

    }

    @Nested
    @DisplayName("GET /api/cognitum/note/path")
    class GetNoteByPath {

        @Test
        @DisplayName("should return note by path")
        void shouldReturnNoteByPath() {
            // Create a note
            RequestNote requestNote = new RequestNote(null, "This is a test note.", "testnote", null, null);
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(requestNote)
                    .when()
                    .post("/api/cognitum/note")
                    .then()
                    .statusCode(200);

            // Get note by path
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .queryParam("path", "testnote")
                    .when()
                    .get("/api/cognitum/note/path")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("path", equalTo("testnote"))
                    .body("text", equalTo("This is a test note."));
        }

        @Test
        @DisplayName("should return 404 when note with path does not exist")
        void shouldReturn404ForNonExistentPath() {
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .queryParam("path", "nonexistent")
                    .when()
                    .get("/api/cognitum/note/path")
                    .then()
                    .statusCode(404);
        }

    }

    @Nested
    @DisplayName("GET /api/cognitum/note/since")
    class GetNotesSince {

        @Test
        @DisplayName("should return notes updated since timestamp")
        void shouldReturnNotesSince() {
            // Create a note with a past timestamp
            RequestNote requestNote = new RequestNote(null, "This is a test note.", "/testnote", null, OffsetDateTime.of(LocalDateTime.of(2000, 1, 2, 0, 0, 0), ZoneOffset.UTC)); // 2000-01-02T00:00:00Z
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(requestNote)
                    .when()
                    .post("/api/cognitum/note")
                    .then()
                    .statusCode(200);

            // Get notes since a past timestamp
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .queryParam("timestamp", "2000-01-01T00:00:00Z")
                    .when()
                    .get("/api/cognitum/note/since")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("$", hasSize(1))
                    .body("[0].path", equalTo("/testnote"))
                    .body("[0].text", equalTo("This is a test note."));
        }

        @Test
        @DisplayName("should return empty list when no notes updated since timestamp")
        void shouldReturnEmptyListForFutureTimestamp() {
            // Create a note
            RequestNote requestNote = new RequestNote(null, "This is a test note.", "/testnote", null, OffsetDateTime.of(LocalDateTime.of(2000, 1, 2, 0, 0, 0), ZoneOffset.UTC));
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .contentType(ContentType.JSON)
                    .body(requestNote)
                    .when()
                    .post("/api/cognitum/note")
                    .then()
                    .statusCode(200);

            // Get notes since a future timestamp
            given()
                    .header("Authorization", "Bearer " + auth.getAccessToken())
                    .queryParam("timestamp", "3000-01-01T00:00:00Z")
                    .when()
                    .get("/api/cognitum/note/since")
                    .then()
                    .statusCode(200)
                    .contentType(ContentType.JSON)
                    .body("$", hasSize(0));
            }

        }

        @Nested
        @DisplayName("POST /api/cognitum/note/move")
        class MoveNote {

            @Test
            @DisplayName("should move note to new path")
            void shouldMoveNote() {
                // Create a note
                RequestNote requestNote = new RequestNote(null, "This is a test note.", "/testnote", null, null);
                given()
                        .header("Authorization", "Bearer " + auth.getAccessToken())
                        .contentType(ContentType.JSON)
                        .body(requestNote)
                        .when()
                        .post("/api/cognitum/note")
                        .then()
                        .statusCode(200);

                // Move the note
                given()
                        .header("Authorization", "Bearer " + auth.getAccessToken())
                        .queryParam("oldPath", "/testnote")
                        .queryParam("newPath", "/newtestnote")
                        .when()
                        .post("/api/cognitum/note/move")
                        .then()
                        .statusCode(200)
                        .contentType(ContentType.JSON)
                        .body("path", equalTo("/newtestnote"))
                        .body("text", equalTo("This is a test note."));
            }

            @Test
            @DisplayName("should return 404 when moving non-existent note")
            void shouldReturn404ForNonExistentNote() {
                given()
                        .header("Authorization", "Bearer " + auth.getAccessToken())
                        .queryParam("oldPath", "/nonexistent")
                        .queryParam("newPath", "/newpath")
                        .when()
                        .post("/api/cognitum/note/move")
                        .then()
                        .statusCode(404);
            }

        }

        @Nested
        @DisplayName("DELETE /api/cognitum/note")
        class DeleteNote {

            @Test
            @DisplayName("should delete note by path")
            void shouldDeleteNote() {
                // Create a note
                RequestNote requestNote = new RequestNote(null, "This is a test note.", "testnote", null, null);
                given()
                        .header("Authorization", "Bearer " + auth.getAccessToken())
                        .contentType(ContentType.JSON)
                        .body(requestNote)
                        .when()
                        .post("/api/cognitum/note")
                        .then()
                        .statusCode(200);

                // Delete the note
                given()
                        .header("Authorization", "Bearer " + auth.getAccessToken())
                        .queryParam("path", "testnote")
                        .when()
                        .delete("/api/cognitum/note")
                        .then()
                        .statusCode(200)
                        .contentType(ContentType.JSON)
                        .body("success", equalTo(true));
            }

            @Test
            @DisplayName("should return 404 when deleting non-existent note")
            void shouldReturn404ForNonExistentNote() {
                given()
                        .header("Authorization", "Bearer " + auth.getAccessToken())
                        .queryParam("path", "nonexistent")
                        .when()
                        .delete("/api/cognitum/note")
                        .then()
                        .statusCode(404);
            }

        }

}
