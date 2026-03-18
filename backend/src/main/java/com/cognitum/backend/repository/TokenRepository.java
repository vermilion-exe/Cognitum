package com.cognitum.backend.repository;

import com.cognitum.backend.entity.Token;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TokenRepository extends JpaRepository<Token, Long> {

    Optional<Token> findByToken(String token);

    List<Token> findAllByUserId(UUID userId);

}
