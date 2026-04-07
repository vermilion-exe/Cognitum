package com.cognitum.backend.config;

import com.cognitum.backend.properties.AISummarizerClient;
import com.cognitum.backend.properties.NvidiaProperties;
import com.cognitum.backend.repository.UserRepository;
import com.cognitum.backend.web.NvidiaWebClient;
import com.cognitum.backend.web.AISummaryWebClient;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

import java.net.http.HttpClient;

@Configuration
@RequiredArgsConstructor
public class ApplicationConfig {

    private final UserRepository repository;
    private final AISummarizerClient aiSummarizerClient;
    private final NvidiaProperties nvidiaProperties;

    @Bean
    public UserDetailsService userDetailsService() {
        return username -> repository.findByEmail(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider(userDetailsService());
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config){
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    AISummaryWebClient aiSummaryWebClient(RestClient.Builder builder) {
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .build();

        JdkClientHttpRequestFactory requestFactory =
                new JdkClientHttpRequestFactory(httpClient);
        RestClient client = builder.baseUrl(aiSummarizerClient.getBaseUrl()).requestFactory(requestFactory).build();

        return HttpServiceProxyFactory
                .builderFor(RestClientAdapter.create(client))
                .build()
                .createClient(AISummaryWebClient.class);
    }

    @Bean
    NvidiaWebClient nvidiaWebClient(RestClient.Builder builder) {
        HttpClient httpClient = HttpClient.newBuilder().build();

        JdkClientHttpRequestFactory requestFactory =
                new JdkClientHttpRequestFactory(httpClient);
        RestClient client = builder
                .baseUrl(nvidiaProperties.getUrl())
                .defaultHeader("Authorization", "Bearer "+nvidiaProperties.getKey())
                .defaultHeader("Content-Type", "application/json")
                .requestFactory(requestFactory)
                .build();

        return HttpServiceProxyFactory
                .builderFor(RestClientAdapter.create(client))
                .build()
                .createClient(NvidiaWebClient.class);
    }

}
