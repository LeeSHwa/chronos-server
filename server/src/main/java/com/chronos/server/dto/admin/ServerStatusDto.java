package com.chronos.server.dto.admin;

import java.time.LocalDateTime;

/**
 * 서버 상태 + 수집 상태.
 *
 * lastSyncAt(서버 응답 시각)만으로는 "로그가 실제로 들어오고 있는가"를 알 수 없었다.
 * DB가 텅 비어 있어도 그 시계는 계속 갱신되기 때문. 그래서 lastEventAt을 추가했다.
 * 전시 당일 가장 자주 볼 값이다.
 *
 * status는 DB 접근 가능 여부만 나타낸다(HEALTHY / DOWN).
 * "최근 이벤트가 없음"을 DEGRADED로 잡지 않는 이유: 관람객이 없어서 조용한 것과
 * 수집이 끊긴 것을 서버가 구분할 수 없어서다. lastEventAt을 그대로 노출하고 판단은 사람이 한다.
 */
public record ServerStatusDto(
        String status,
        String version,
        LocalDateTime lastSyncAt,
        LocalDateTime lastEventAt,
        long eventsToday,
        long eventsTotal
) {
    /** 리포지토리가 채우는 수집 통계 부분. */
    public record Collection(LocalDateTime lastEventAt, long eventsToday, long eventsTotal) {}
}
