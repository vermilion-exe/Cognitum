package com.cognitum.backend.integration;

import com.cognitum.backend.dto.request.RequestCompletion;
import com.cognitum.backend.dto.request.RequestMessage;
import com.cognitum.backend.dto.request.RequestSummary;
import com.cognitum.backend.dto.response.ResponseChoice;
import com.cognitum.backend.dto.response.ResponseCompletion;
import com.cognitum.backend.dto.response.ResponseSummary;
import com.cognitum.backend.web.AISummaryWebClient;
import com.cognitum.backend.web.NvidiaWebClient;
import io.github.cdimascio.dotenv.Dotenv;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public abstract class BaseIntegrationTest {

    @LocalServerPort
    protected Integer port;

    @MockitoBean
    protected NvidiaWebClient nvidiaWebClient;

    @MockitoBean
    protected AISummaryWebClient aiSummaryWebClient; 

    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17")
            .withDatabaseName("cognitum_test")
            .withUsername("test")
            .withPassword("test")
            .withInitScript("init.sql");

    static {
        postgres.start();
    }

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
        registry.add("application.security.jwt.secret-key", () -> dotenv.get("TEST_JWT_SECRET_KEY"));
        registry.add("nvidia.api.key", () -> dotenv.get("NVIDIA_API_KEY"));
    }

    @BeforeEach
    void stubExternalAiResponses() {
        when(nvidiaWebClient.requestCompletion(any(RequestCompletion.class)))
                .thenAnswer(invocation -> responseFor(invocation.getArgument(0)));
        when(aiSummaryWebClient.summarize(any(RequestSummary.class)))
                .thenAnswer(invocation -> summaryFor(invocation.getArgument(0)));
    }

    private ResponseCompletion responseFor(RequestCompletion request) {
        String systemPrompt = request.getMessages().stream()
                .filter(message -> "system".equals(message.getRole()))
                .map(RequestMessage::getContent)
                .findFirst()
                .orElse("");

        if (systemPrompt.contains("raw JSON array of UUIDs")) {
            return completion("[]");
        }

        if (systemPrompt.contains("flashcard generation assistant")) {
            return completion("""
                    [
                      {"question":"What is SOLID?","answer":"A set of object-oriented design principles.","type":"factual"},
                      {"question":"What does SRP encourage?","answer":"A class should have one reason to change.","type":"conceptual"},
                      {"question":"How does OCP guide extension?","answer":"Software should be open for extension and closed for modification.","type":"application"},
                      {"question":"Why use LSP?","answer":"Subtypes should be substitutable for their base types.","type":"conceptual"},
                      {"question":"What does DIP prefer?","answer":"Depend on abstractions rather than concrete implementations.","type":"factual"}
                    ]
                    """);
        }

        return completion("A concise test explanation for the selected concept.");
    }

    private ResponseCompletion completion(String content) {
        return new ResponseCompletion(List.of(new ResponseChoice(new RequestMessage("assistant", content))));
    }

    private ResponseSummary summaryFor(RequestSummary request) {
        String markdown = request == null || request.getMarkdown() == null ? "the provided note" : request.getMarkdown();
        return new ResponseSummary(null, "Template summary for: " + markdown, null);
    }

}
