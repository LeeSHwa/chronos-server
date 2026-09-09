package com.chronos.server.dto.admin;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 유저 이벤트 목록 (cursor 페이징).
 *
 * ⚠️ 기존 timestamp 필드는 clientTime / serverTime 둘로 쪼개졌다.
 *    - clientTime: 클라가 보낸 시각. nullable (클라가 안 보내면 없음)
 *    - serverTime: 서버 수신 시각. NOT NULL. 정렬/집계의 기준
 *    둘의 차이가 벌어지면 클라 시계 이상이거나 전송이 밀리고 있다는 뜻이다.
 *    (클라 배치 주기가 15초라 수 초~십수 초 차이는 정상)
 */
public record UserEventsDto(List<EventRow> events, String nextCursor) {
    public record EventRow(
            long id,
            String eventType,
            LocalDateTime clientTime,
            LocalDateTime serverTime,
            // runId도 64비트 시드다. userId와 같은 이유로 String.
            String runId,
            Integer floor,
            String round,
            String difficulty,
            Map<String, Object> payload
    ) {}
}
