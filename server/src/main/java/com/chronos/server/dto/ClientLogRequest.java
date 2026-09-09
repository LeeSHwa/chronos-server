package com.chronos.server.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
public class ClientLogRequest {
    private Long userId;
    private String eventType;
    private OffsetDateTime timestamp;
    private String difficulty;
    private Long runId;
    private Integer floor;
    private String round;
    private Map<String, Object> payload;
}
