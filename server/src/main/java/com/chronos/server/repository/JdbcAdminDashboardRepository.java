package com.chronos.server.repository;

import com.chronos.server.dto.admin.FloorStatsDto;
import com.chronos.server.dto.admin.OverviewDto;
import com.chronos.server.dto.admin.ServerStatusDto;
import com.chronos.server.dto.admin.UserEventsDto;
import com.chronos.server.dto.admin.UserSearchDto;
import com.chronos.server.dto.admin.UserSummaryDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 관리자 대시보드 조회 전용 리포지토리 (PostgreSQL).
 *
 * 스키마 이행 메모 (H2 → PostgreSQL):
 *  - timestamp 컬럼은 사라졌다. client_time(클라 시각, nullable) / server_time(수신 시각, NOT NULL)로 분리.
 *    집계·필터는 전부 server_time 기준이다. 클라 시계를 신뢰할 수 없고 NULL이 섞이지 않기 때문.
 *  - payload가 JSONB라 LIKE를 쓸 수 없다. ->> 로 text를 뽑아 비교한다.
 *  - round가 VARCHAR로 바뀌었다. 숫자가 아닌 값도 들어올 수 있어 정렬 시 숫자 캐스팅을 조건부로 한다.
 *  - COUNT(CASE WHEN ...) 대신 PostgreSQL의 COUNT(*) FILTER (WHERE ...)를 쓴다.
 *
 * 타임존: 날짜/시(hour) 절단은 DB 세션 타임존을 따른다. pgjdbc가 접속 시 세션 TZ를 JVM 기본값으로
 * 맞추므로, 서버와 전시 PC가 같은 타임존(Asia/Seoul)이면 그대로 의도대로 동작한다.
 */
@Repository
public class JdbcAdminDashboardRepository implements AdminDashboardRepository {

    /** 이 시각 이후 이벤트가 있으면 접속 중으로 본다. */
    private static final int ONLINE_WINDOW_MINUTES = 5;

    /** DAU 추이 구간(오늘 포함 14일). */
    private static final int DAU_SERIES_DAYS = 14;

    /**
     * 숫자로만 된 round는 숫자로, 그 외(예: "BOSS")는 문자로 정렬한다.
     * VARCHAR 그대로 정렬하면 "10" < "2"가 되어 진행 순서가 어긋난다.
     */
    private static final String ROUND_ORDER =
            "(CASE WHEN round ~ '^[0-9]+$' THEN round::int END) NULLS LAST, round";
    /**
     * 내림차순에서는 NULLS FIRST 여야 한다.
     * 보스 라운드 "B"는 숫자가 아니라 CASE 결과가 NULL인데, 진행 순서로는 그 층의 마지막이다.
     * NULLS LAST로 두면 가장 깊이 간 지점을 찾을 때 보스가 꼴찌로 밀려 1-4가 최고 도달로 잡힌다.
     */
    private static final String ROUND_ORDER_DESC =
            "(CASE WHEN round ~ '^[0-9]+$' THEN round::int END) DESC NULLS FIRST, round DESC";

    /** payload 값이 정수 문자열일 때만 집계에 넣는다. 이상한 값 하나로 500이 나는 걸 막는다. */
    private static final String NUMERIC_GUARD = " ~ '^[0-9]+$'";

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper = new ObjectMapper();

    public JdbcAdminDashboardRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ─────────────────────────────────────────────
    // 개요
    // ─────────────────────────────────────────────

    @Override
    public OverviewDto getOverview() {
        OffsetDateTime startOfToday = startOfToday();
        OffsetDateTime startOfTomorrow = startOfDay(today().plusDays(1));
        OffsetDateTime seriesFrom = startOfDay(today().minusDays(DAU_SERIES_DAYS - 1L));
        OffsetDateTime onlineCutoff = OffsetDateTime.now().minusMinutes(ONLINE_WINDOW_MINUTES);

        // ACCOUNT_LOGIN 기준. 클라가 로그인 이벤트를 못 보내면 0이 된다.
        String dauQuery = """
                SELECT COUNT(DISTINCT user_id)
                FROM game_events
                WHERE event_type = 'ACCOUNT_LOGIN'
                  AND server_time >= ?
                  AND server_time <  ?
                """;

        // 관람객 수에 가장 가까운 값. userId는 기기 단위라 사람을 못 센다.
        String playsQuery = """
                SELECT COUNT(DISTINCT run_id)
                FROM game_events
                WHERE run_id IS NOT NULL
                  AND server_time >= ?
                  AND server_time <  ?
                """;

        String runsStartedQuery = """
                SELECT COUNT(DISTINCT run_id)
                FROM game_events
                WHERE event_type = 'RUN_START'
                  AND run_id IS NOT NULL
                  AND server_time >= ?
                  AND server_time <  ?
                """;

        // DISTINCT run_id: RUN_END가 여러 곳에서 호출돼 중복 적재돼도 판 수는 한 번만 센다.
        String runsClearedQuery = """
                SELECT COUNT(DISTINCT run_id)
                FROM game_events
                WHERE event_type = 'RUN_END'
                  AND payload ->> 'result' = 'WIN'
                  AND run_id IS NOT NULL
                  AND server_time >= ?
                  AND server_time <  ?
                """;

        String dauSeriesQuery = """
                SELECT server_time::date       AS d,
                       COUNT(DISTINCT user_id) AS dau
                FROM game_events
                WHERE event_type = 'ACCOUNT_LOGIN'
                  AND server_time >= ?
                GROUP BY d
                ORDER BY d
                """;

        String hourlyQuery = """
                SELECT EXTRACT(HOUR FROM server_time)::int AS h,
                       COUNT(DISTINCT run_id)              AS plays,
                       COUNT(*)                            AS events
                FROM game_events
                WHERE server_time >= ?
                  AND server_time <  ?
                GROUP BY h
                ORDER BY h
                """;

        // difficulty는 런 시작 시 확정돼 런 내내 불변이라 run_id 단위 집계가 안전하다.
        // 클라는 대문자("LIMITED"), 더미는 파스칼("Limited")로 보내므로 upper()로 합친다.
        String difficultyQuery = """
                SELECT upper(difficulty)      AS diff,
                       COUNT(DISTINCT run_id) AS plays,
                       COUNT(DISTINCT run_id) FILTER (
                           WHERE event_type = 'RUN_END' AND payload ->> 'result' = 'WIN'
                       )                      AS cleared
                FROM game_events
                WHERE difficulty IS NOT NULL
                  AND run_id IS NOT NULL
                  AND server_time >= ?
                  AND server_time <  ?
                GROUP BY upper(difficulty)
                ORDER BY plays DESC
                """;

        String recentUsersQuery = """
                SELECT user_id,
                       MAX(server_time)       AS last_seen,
                       COUNT(DISTINCT run_id) FILTER (WHERE event_type = 'RUN_START') AS run_count
                FROM game_events
                WHERE user_id IS NOT NULL
                GROUP BY user_id
                ORDER BY last_seen DESC
                LIMIT 10
                """;

        long dauToday = count(dauQuery, startOfToday, startOfTomorrow);
        long playsToday = count(playsQuery, startOfToday, startOfTomorrow);
        long runsStartedToday = count(runsStartedQuery, startOfToday, startOfTomorrow);
        long runsClearedToday = count(runsClearedQuery, startOfToday, startOfTomorrow);

        List<OverviewDto.DauPoint> dauSeries = jdbc.query(dauSeriesQuery,
                (rs, n) -> new OverviewDto.DauPoint(
                        rs.getObject("d", LocalDate.class),
                        rs.getLong("dau")
                ),
                seriesFrom
        );

        List<OverviewDto.HourPoint> hourlyToday = jdbc.query(hourlyQuery,
                (rs, n) -> new OverviewDto.HourPoint(
                        rs.getInt("h"),
                        rs.getLong("plays"),
                        rs.getLong("events")
                ),
                startOfToday, startOfTomorrow
        );

        List<OverviewDto.DifficultyCount> difficultyToday = jdbc.query(difficultyQuery,
                (rs, n) -> new OverviewDto.DifficultyCount(
                        rs.getString("diff"),
                        rs.getLong("plays"),
                        rs.getLong("cleared")
                ),
                startOfToday, startOfTomorrow
        );

        List<OverviewDto.RecentUser> recentUsers = jdbc.query(recentUsersQuery,
                (rs, n) -> {
                    LocalDateTime lastSeen = localTime(rs, "last_seen");
                    return new OverviewDto.RecentUser(
                            String.valueOf(rs.getLong("user_id")),
                            lastSeen,
                            rs.getLong("run_count"),
                            lastSeen != null && lastSeen.isAfter(onlineCutoff.toLocalDateTime())
                    );
                }
        );

        return new OverviewDto(
                dauToday,
                playsToday,
                runsStartedToday,
                runsClearedToday,
                dauSeries,
                hourlyToday,
                difficultyToday,
                recentUsers
        );
    }

    // ─────────────────────────────────────────────
    // 층별 통계
    // ─────────────────────────────────────────────

    @Override
    public FloorStatsDto getFloorStats(LocalDate from, LocalDate to) {
        OffsetDateTime fromTs = startOfDay(from);
        OffsetDateTime toTs = startOfDay(to.plusDays(1));

        String totalRunsQuery = """
                SELECT COUNT(DISTINCT run_id)
                FROM game_events
                WHERE event_type = 'RUN_START'
                  AND run_id IS NOT NULL
                  AND server_time >= ?
                  AND server_time <  ?
                """;

        String totalRunsByDifficultyQuery = """
                SELECT upper(difficulty)      AS diff,
                       COUNT(DISTINCT run_id) AS total
                FROM game_events
                WHERE event_type = 'RUN_START'
                  AND run_id IS NOT NULL
                  AND difficulty IS NOT NULL
                  AND server_time >= ?
                  AND server_time <  ?
                GROUP BY upper(difficulty)
                """;

        long totalRuns = count(totalRunsQuery, fromTs, toTs);

        Map<String, Long> totalRunsByDifficulty = new LinkedHashMap<>();
        jdbc.query(totalRunsByDifficultyQuery,
                        (rs, n) -> Map.entry(rs.getString("diff"), rs.getLong("total")),
                        fromTs, toTs)
                .forEach(e -> totalRunsByDifficulty.put(e.getKey(), e.getValue()));

        List<FloorStatsDto.FloorRow> floors =
                jdbc.query(floorRowsQuery(false), floorRowMapper(false), fromTs, toTs);
        List<FloorStatsDto.FloorRow> floorsByDifficulty =
                jdbc.query(floorRowsQuery(true), floorRowMapper(true), fromTs, toTs);

        return new FloorStatsDto(totalRuns, totalRunsByDifficulty, floors, floorsByDifficulty);
    }

    /**
     * 층별 집계 SQL. (로그 명세 v0.4 기준)
     *
     * 한 줄이 "어떤 런이 어떤 스테이지를 한 번 지나간 것"이 되도록 먼저 stage CTE로 접은 뒤 집계한다.
     * 이벤트를 그대로 세지 않는 이유는 이어하기 때문이다. 판 도중 게임을 끄면 같은 스테이지를
     * 다시 클리어하므로 ROUND_CLEAR가 두 번 나간다(명세 4.5). 이벤트를 세면 클리어 수가
     * 도달 수보다 많아져 클리어율이 100%를 넘는다.
     *
     * 스테이지 소요 시간은 ROUND_CLEAR의 clearElapsedMs에서 같은 스테이지 ROUND_ENTER의
     * elapsedMs를 뺀 값이다. ROUND_CLEAR 자체는 리워드·정비가 끝난 Save 시점에 나가지만
     * clearElapsedMs는 클리어한 순간의 스냅샷이라(명세 3.3), 리워드·정비 시간이 섞이지 않는다.
     *
     * @param byDifficulty true면 난이도를 그룹 키에 추가한다.
     */
    private String floorRowsQuery(boolean byDifficulty) {
        String difficultySelect = byDifficulty ? "diff," : "CAST(NULL AS TEXT) AS diff,";
        String difficultyGroup = byDifficulty ? "diff, " : "";
        String difficultyFilter = byDifficulty ? "AND difficulty IS NOT NULL" : "";

        return """
                WITH stage AS (
                    SELECT run_id,
                           floor,
                           round,
                           upper(difficulty) AS diff,
                           COUNT(*) FILTER (WHERE event_type = 'ROUND_ENTER')  AS enters,
                           COUNT(*) FILTER (WHERE event_type = 'ROUND_CLEAR')  AS clears,
                           COUNT(*) FILTER (WHERE event_type = 'PLAYER_DEATH') AS deaths,
                           MIN((payload ->> 'elapsedMs')::bigint) FILTER (
                               WHERE event_type = 'ROUND_ENTER' AND payload ->> 'elapsedMs'%1$s
                           ) AS enter_ms,
                           MAX((payload ->> 'clearElapsedMs')::bigint) FILTER (
                               WHERE event_type = 'ROUND_CLEAR' AND payload ->> 'clearElapsedMs'%1$s
                           ) AS clear_ms,
                           MIN((payload ->> 'overclockDeciseconds')::int) FILTER (
                               WHERE event_type = 'ROUND_ENTER' AND payload ->> 'overclockDeciseconds'%1$s
                           ) AS enter_oc
                    FROM game_events
                    WHERE event_type IN ('ROUND_ENTER', 'ROUND_CLEAR', 'PLAYER_DEATH')
                      AND run_id IS NOT NULL
                      AND floor   IS NOT NULL
                      AND round   IS NOT NULL
                      AND server_time >= ?
                      AND server_time <  ?
                      %2$s
                    GROUP BY run_id, floor, round, upper(difficulty)
                )
                SELECT %3$s
                       floor,
                       round,
                       COUNT(*) FILTER (WHERE enters > 0) AS entered,
                       COUNT(*) FILTER (WHERE clears > 0) AS cleared,
                       SUM(deaths)                        AS deaths,
                       AVG(clear_ms - enter_ms) FILTER (
                           WHERE clear_ms IS NOT NULL AND enter_ms IS NOT NULL AND clear_ms >= enter_ms
                       ) AS avg_clear_ms,
                       AVG(enter_oc) AS avg_enter_oc
                FROM stage
                GROUP BY %4$sfloor, round
                ORDER BY %4$sfloor, %5$s
                """.formatted(
                NUMERIC_GUARD,
                difficultyFilter,
                difficultySelect,
                difficultyGroup,
                ROUND_ORDER
        );
    }

    private RowMapper<FloorStatsDto.FloorRow> floorRowMapper(boolean byDifficulty) {
        return (rs, n) -> {
            int floor = rs.getInt("floor");
            String round = rs.getString("round");
            long entered = rs.getLong("entered");
            long cleared = rs.getLong("cleared");
            double clearRate = entered == 0 ? 0.0 : (double) cleared / entered;
            Double avgClearMs = numeric(rs, "avg_clear_ms");

            return new FloorStatsDto.FloorRow(
                    floor,
                    round,
                    floor + "-" + round,
                    byDifficulty ? rs.getString("diff") : null,
                    entered,
                    cleared,
                    clearRate,
                    avgClearMs == null ? null : Math.round(avgClearMs),
                    rs.getLong("deaths"),
                    numeric(rs, "avg_enter_oc")
            );
        };
    }

    // ─────────────────────────────────────────────
    // 유저
    // ─────────────────────────────────────────────

    @Override
    public UserSearchDto searchUsers(String prefix) {
        String q = """
                SELECT user_id,
                       COUNT(DISTINCT run_id) FILTER (WHERE event_type = 'RUN_START') AS run_count,
                       MAX(server_time)                                               AS last_seen_at
                FROM game_events
                WHERE user_id IS NOT NULL
                  AND CAST(user_id AS VARCHAR) LIKE ?
                GROUP BY user_id
                ORDER BY last_seen_at DESC
                LIMIT 50
                """;

        List<UserSearchDto.Hit> hits = jdbc.query(q,
                (rs, n) -> new UserSearchDto.Hit(
                        String.valueOf(rs.getLong("user_id")),
                        rs.getLong("run_count"),
                        localTime(rs, "last_seen_at")
                ),
                prefix + "%"
        );
        return new UserSearchDto(hits);
    }

    @Override
    public Optional<UserSummaryDto> getUserSummary(long userId) {
        String summaryQuery = """
                SELECT MAX(server_time)                                              AS last_seen_at,
                       COUNT(DISTINCT run_id) FILTER (WHERE event_type = 'RUN_START') AS total_runs,
                       COUNT(DISTINCT run_id) FILTER (WHERE event_type = 'RUN_END')   AS run_ends,
                       COUNT(DISTINCT run_id) FILTER (
                           WHERE event_type = 'RUN_END' AND payload ->> 'result' = 'WIN'
                       )                                                              AS wins
                FROM game_events
                WHERE user_id = ?
                """;

        UserSummaryDto dto = jdbc.queryForObject(summaryQuery, (rs, n) -> {
            LocalDateTime lastSeenAt = localTime(rs, "last_seen_at");
            if (lastSeenAt == null) return null;  // 이벤트 없음 → 404 신호

            long runEnds = rs.getLong("run_ends");
            long wins = rs.getLong("wins");

            return new UserSummaryDto(
                    String.valueOf(userId),
                    rs.getLong("total_runs"),
                    findMaxFloor(userId),
                    lastSeenAt,
                    findAvgRunTimeMs(userId),
                    runEnds == 0 ? null : (double) wins / runEnds
            );
        }, userId);

        return Optional.ofNullable(dto);
    }

    /**
     * 최고 도달 지점.
     *
     * 로그 명세 v0.4부터 모든 이벤트의 round가 "플레이어가 지나간 순서"로 통일됐다(명세 1.5).
     * 섞인 맵 번호가 섞여 들어오던 문제가 사라져서, 스테이지 단위 이벤트를 그대로 쓸 수 있다.
     * 진입만 하고 못 깬 스테이지도 도달로 치므로 ROUND_ENTER를 포함한다.
     */
    private UserSummaryDto.MaxFloor findMaxFloor(long userId) {
        String q = """
                SELECT floor, round
                FROM game_events
                WHERE user_id = ?
                  AND floor IS NOT NULL
                  AND round IS NOT NULL
                  AND event_type IN ('ROUND_ENTER', 'ROUND_CLEAR', 'PLAYER_DEATH', 'RUN_END')
                ORDER BY floor DESC, %s
                LIMIT 1
                """.formatted(ROUND_ORDER_DESC);

        List<UserSummaryDto.MaxFloor> rows = jdbc.query(q,
                (rs, n) -> {
                    int f = rs.getInt("floor");
                    String r = rs.getString("round");
                    return new UserSummaryDto.MaxFloor(f, r, f + "-" + r);
                },
                userId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * 평균 런 시간.
     *
     * 로그 명세 v0.4의 RUN_END.elapsedMs는 "그 판에서 실제로 플레이한 누적 시간"이라
     * 그대로 평균 내면 된다. 시계가 아니라 플레이 시간이므로 이어하기로 며칠에 걸쳐 끝낸 판도
     * 정상적인 값이 나온다. (예전에는 믿을 값이 없어 첫~마지막 이벤트 간격으로 추정했는데,
     * 그 방식은 중간에 게임을 끄고 다음 날 이어한 판을 수십 시간짜리로 잡았다.)
     *
     * RUN_END 없이 끊긴 판(게임을 그냥 끔)은 평균에서 빠진다. 끝나지 않은 판이라 당연하다.
     */
    private Long findAvgRunTimeMs(long userId) {
        String q = """
                SELECT AVG(elapsed_ms)::float8
                FROM (
                    SELECT MAX((payload ->> 'elapsedMs')::bigint) AS elapsed_ms
                    FROM game_events
                    WHERE user_id = ?
                      AND event_type = 'RUN_END'
                      AND run_id IS NOT NULL
                      AND payload ->> 'elapsedMs'%s
                    GROUP BY run_id
                ) t
                """.formatted(NUMERIC_GUARD);
        Double avg = jdbc.queryForObject(q, Double.class, userId);
        return avg == null ? null : Math.round(avg);
    }

    @Override
    public UserEventsDto getUserEvents(long userId, Long cursor, int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT id, event_type, client_time, server_time, run_id, floor, round, difficulty, payload
                FROM game_events
                WHERE user_id = ?
                """);
        List<Object> params = new ArrayList<>();
        params.add(userId);

        if (cursor != null) {
            sql.append(" AND id < ? ");
            params.add(cursor);
        }
        sql.append(" ORDER BY id DESC LIMIT ? ");
        params.add(limit);

        List<UserEventsDto.EventRow> events = jdbc.query(sql.toString(),
                (rs, n) -> new UserEventsDto.EventRow(
                        rs.getLong("id"),
                        rs.getString("event_type"),
                        localTime(rs, "client_time"),
                        localTime(rs, "server_time"),
                        toStringOrNull(rs.getObject("run_id", Long.class)),
                        rs.getObject("floor", Integer.class),
                        rs.getString("round"),
                        rs.getString("difficulty"),
                        parsePayload(rs.getString("payload"))
                ),
                params.toArray()
        );

        // limit 만큼 꽉 채워 돌아왔으면 다음 페이지가 있을 수 있음
        String nextCursor = events.size() == limit
                ? String.valueOf(events.get(events.size() - 1).id())
                : null;

        return new UserEventsDto(events, nextCursor);
    }

    // ─────────────────────────────────────────────
    // 수집 상태
    // ─────────────────────────────────────────────

    @Override
    public ServerStatusDto.Collection getCollectionStats() {
        String q = """
                SELECT MAX(server_time) AS last_event_at,
                       COUNT(*) FILTER (WHERE server_time >= ? AND server_time < ?) AS events_today,
                       COUNT(*)                                                     AS events_total
                FROM game_events
                """;

        return jdbc.queryForObject(q,
                (rs, n) -> new ServerStatusDto.Collection(
                        localTime(rs, "last_event_at"),
                        rs.getLong("events_today"),
                        rs.getLong("events_total")
                ),
                startOfToday(), startOfDay(today().plusDays(1))
        );
    }

    // ─────────────────────────────────────────────
    // helpers
    // ─────────────────────────────────────────────

    private long count(String sql, Object... args) {
        Long v = jdbc.queryForObject(sql, Long.class, args);
        return v == null ? 0L : v;
    }

    /**
     * TIMESTAMPTZ 컬럼 → 서버 로컬 시각.
     *
     * pgjdbc는 timestamptz를 LocalDateTime으로 직접 변환하지 못한다
     * ("Cannot convert the column of type TIMESTAMPTZ to requested type java.time.LocalDateTime").
     * OffsetDateTime(UTC 기준)으로 받아서 로컬 존으로 옮긴 뒤 벽시계 시각을 취한다.
     * H2(TIMESTAMP) 시절엔 바로 LocalDateTime으로 읽히던 자리다.
     */
    private static LocalDateTime localTime(ResultSet rs, String column) throws SQLException {
        OffsetDateTime odt = rs.getObject(column, OffsetDateTime.class);
        return odt == null ? null : odt.atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
    }

    /** 64비트 ID를 JSON 문자열로 내보내기 위한 변환. null은 null 그대로. */
    private static String toStringOrNull(Long v) {
        return v == null ? null : String.valueOf(v);
    }

    /**
     * numeric 컬럼 → Double.
     *
     * AVG()는 numeric을 돌려주는데 pgjdbc가 getObject(col, Double.class)를 지원하지 않는다
     * ("conversion to class java.lang.Double from numeric not supported"). BigDecimal로 받는다.
     */
    private static Double numeric(ResultSet rs, String column) throws SQLException {
        BigDecimal v = rs.getBigDecimal(column);
        return v == null ? null : v.doubleValue();
    }

    private LocalDate today() {
        return LocalDate.now(ZoneId.systemDefault());
    }

    private OffsetDateTime startOfToday() {
        return startOfDay(today());
    }

    /** TIMESTAMPTZ 비교용. 오프셋을 명시해 세션 타임존 해석에 의존하지 않게 한다. */
    private OffsetDateTime startOfDay(LocalDate date) {
        return date.atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parsePayload(String json) {
        if (json == null) return null;
        try {
            return mapper.readValue(json, Map.class);
        } catch (JsonProcessingException e) {
            return null;
        }
    }
}
