package com.chronos.server.dummyGenerator;

import com.chronos.server.dto.ClientLogRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 더미 로그 전용 적재기. (local 프로파일에서만 로드됨)
 *
 * 수집 경로(LogService → JdbcLogRepository)를 쓰지 않고 따로 INSERT 하는 이유는 하나다.
 * <b>server_time을 과거 시각으로 박아야 하기 때문</b>이다.
 *
 *  - 실제 수집에서는 server_time을 컬럼 목록에서 빼고 스키마의 DEFAULT now()에 맡긴다.
 *    "서버 수신 시각은 서버만 찍는다"는 원칙이고, 클라가 보낸 시각을 수신 시각으로 믿지 않는다.
 *  - 반면 더미는 30일치를 한 번에 밀어 넣는다. 같은 경로로 넣으면 1만여 건의 server_time이
 *    전부 "생성기를 돌린 순간"이 되어, server_time 기준인 어드민 집계가 전부 하루에 뭉친다.
 *
 * INSERT 목록에 server_time을 명시하면 DEFAULT는 적용되지 않으므로, 두 경로가 서로 간섭하지 않는다.
 *
 * server_time = client_time + 전송 지연(0~15초). 클라 배치 주기가 15초인 점을 반영한 것으로,
 * 어드민 화면에서 두 시각이 조금 어긋나 보이는 것까지 실제와 같게 만든다.
 */
@Component
@Profile("local")
public class DummyLogWriter {

    private static final String INSERT_SQL = """
            INSERT INTO game_events
                (user_id, event_type, client_time, server_time, run_id, floor, round, difficulty, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
            """;

    /** 1만 건 이상을 한 번에 보내면 드라이버 버퍼가 커지므로 나눠 보낸다. */
    private static final int BATCH_SIZE = 500;

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper = new ObjectMapper();

    public DummyLogWriter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 생성기가 만든 이벤트를 순서대로 적재한다. 리스트 순서가 곧 id 순서가 된다. */
    public void write(List<DummyEvent> events) {
        List<Object[]> batch = new ArrayList<>(BATCH_SIZE);

        for (DummyEvent event : events) {
            batch.add(toRow(event));
            if (batch.size() == BATCH_SIZE) {
                jdbc.batchUpdate(INSERT_SQL, batch);
                batch.clear();
            }
        }
        if (!batch.isEmpty()) {
            jdbc.batchUpdate(INSERT_SQL, batch);
        }
    }

    private Object[] toRow(DummyEvent event) {
        ClientLogRequest log = event.log();
        return new Object[]{
                log.getUserId(),
                log.getEventType(),
                log.getTimestamp(),
                event.serverTime(),
                log.getRunId(),
                log.getFloor(),
                log.getRound(),
                log.getDifficulty(),
                toJson(log)
        };
    }

    private String toJson(ClientLogRequest log) {
        if (log.getPayload() == null) return null;
        try {
            return mapper.writeValueAsString(log.getPayload());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("더미 payload 직렬화 실패: " + log.getEventType(), e);
        }
    }

    /** 로그 한 건 + 그 로그가 서버에 도착한 시각. */
    public record DummyEvent(ClientLogRequest log, OffsetDateTime serverTime) {}
}
