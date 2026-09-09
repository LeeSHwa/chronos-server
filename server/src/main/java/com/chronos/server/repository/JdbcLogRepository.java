package com.chronos.server.repository;

import com.chronos.server.domain.ClientLog;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcLogRepository implements LogRepository {

    private static final String INSERT_SQL = """
            INSERT INTO game_events
                (user_id, event_type, client_time, difficulty, run_id, floor, round, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb)
            """;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper mapper = new ObjectMapper();

    public JdbcLogRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public ClientLog save(ClientLog clientLog) {
        try {
            jdbcTemplate.update(INSERT_SQL,
                    clientLog.getUserId(),
                    clientLog.getEventType(),
                    clientLog.getTimestamp(),
                    clientLog.getDifficulty(),
                    clientLog.getRunId(),
                    clientLog.getFloor(),
                    clientLog.getRound(),
                    mapper.writeValueAsString(clientLog.getPayload())
            );
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
        return clientLog;
    }
}
