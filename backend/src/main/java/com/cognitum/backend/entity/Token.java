package com.cognitum.backend.entity;

import com.cognitum.backend.enums.TokenType;
import jakarta.persistence.*;
import lombok.*;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Getter
@Setter
@Table(name = "Token", schema = "cognitum_data")
public class Token {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column
    private Long id;

    @Column(unique = true, columnDefinition = "TEXT")
    private String token;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TokenType tokenType = TokenType.BEARER;

    @Column
    private Boolean revoked;

    @Column
    private Boolean expired;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

}
