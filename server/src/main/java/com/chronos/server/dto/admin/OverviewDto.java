package com.chronos.server.dto.admin;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 대시보드 첫 화면 집계.
 *
 * 기존 필드(dauToday / runsStartedToday / runsClearedToday / dauSeries / recentUsers)는
 * 프론트가 이미 쓰고 있으므로 그대로 두고, 전시용 지표만 덧붙였다.
 *
 * ⚠️ userId는 '사람'이 아니라 설치(기기) 식별자다(client-log-spec 4장).
 *    관람객 수를 세는 정확한 기준은 dauToday가 아니라 playsToday(= DISTINCT run_id).
 */
public record OverviewDto(
        long dauToday,
        long playsToday,
        long runsStartedToday,
        long runsClearedToday,
        List<DauPoint> dauSeries,
        List<HourPoint> hourlyToday,
        List<DifficultyCount> difficultyToday,
        List<RecentUser> recentUsers
) {
    public record DauPoint(LocalDate date, long dau) {}

    /** 오늘 시간대별 집계. 전시 부스 혼잡도용. hour는 0~23(서버 로컬 타임존 기준). */
    public record HourPoint(int hour, long plays, long events) {}

    /** 난이도별 판 수. difficulty는 upper()로 정규화된 값. */
    public record DifficultyCount(String difficulty, long plays, long cleared) {}

    /**
     * userId는 64비트 시드라 JS Number(53비트 정수)로는 정확히 표현되지 않는다.
     * 숫자로 내려보내면 JSON.parse 시점에 반올림돼 존재하지 않는 ID가 된다.
     * (예: ...332156 → ...332200 으로 바뀌어 조회하면 404)
     *
     * @JsonSerialize(ToStringSerializer)를 record 컴포넌트에 붙이는 방식은 동작하지 않아서
     * 타입 자체를 String으로 둔다. 직렬화 설정에 기대지 않으므로 깨질 여지가 없다.
     */
    public record RecentUser(
            String userId,
            LocalDateTime lastSeenAt,
            long runCount,
            boolean isOnline
    ) {}
}
