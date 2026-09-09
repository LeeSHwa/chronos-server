package com.chronos.server.domain;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Map;

@Getter
public class ClientLog {
    @Setter
    private Long id;
    private final Long userId;
    private final String eventType;
    private final OffsetDateTime timestamp;
    private final String difficulty;
    private final Long runId;
    private final Integer floor;
    private final String round;
    private final Map<String, Object> payload;

    @Builder
    public ClientLog(Long userId, String eventType, OffsetDateTime timestamp,
                     String difficulty,
                     Long runId, Integer floor, String round,
                     Map<String, Object> payload) {
        this.userId = userId;
        this.eventType = eventType;
        this.timestamp = timestamp;
        this.difficulty = difficulty;
        this.runId = runId;
        this.floor = floor;
        this.round = round;
        this.payload = payload;
    }
}
