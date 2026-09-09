package com.chronos.server.dummyGenerator;

import com.chronos.server.dto.ClientLogRequest;
import com.chronos.server.service.LogService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * 부팅 시 게임 클라이언트 로그를 시뮬레이션해 적재.
 * 명세: docs/client-log-spec.md
 *
 * 시뮬레이션 단위:
 *   유저 × 로그인 세션 × 런(여러 floor-round 진입/클리어/사망 → RUN_END)
 *
 * 데이터 분포 가정:
 *   - 50 유저, 각 유저 3~15 로그인 일, 로그인당 1~3 런
 *   - 최근 3일에 40% 가중치 (오늘 데모용 KPI 보장)
 *   - 층별 클리어율 점진 하락 (98% → 45%) → 차트가 자연스러운 곡선
 *
 * ⚠️ local 프로파일에서만 동작한다.
 *    PostgreSQL은 H2(인메모리)와 달리 데이터가 영구 보존되므로, 게이트가 없으면
 *    부팅할 때마다 수천 건이 계속 누적된다. 전시 빌드에서는 프로파일을 켜지 말 것.
 */
@Component
@Profile("local")
public class DummyLogInitializer implements ApplicationRunner {

    private static final int USER_COUNT = 50;
    private static final int DAYS_BACK = 30;
    private static final int CLIENT_ERROR_COUNT = 15;

    private static final String[] PLATFORMS = {"PC", "MOBILE", "CONSOLE"};
    private static final String[] REGIONS = {"KR", "US", "JP", "EU"};
    private static final String[] CLIENT_VERSIONS = {"1.2.1", "1.2.2", "1.2.3"};
    private static final String[] CHARACTER_CLASSES = {"WARRIOR", "ROGUE", "MAGE"};
    private static final String[] ERROR_CODES = {"ERR_PHYSICS_OVERLAP", "ERR_SYNC_TIMEOUT", "ERR_ASSET_LOAD"};
    private static final String[] BOSSES = {"Boss_Chronos_Slayer", "Boss_Time_Rift", "Boss_Void_Warden"};

    /** 클라 DifficultyTier enum 이름. 엔벨로프는 이 문자열을 그대로 보낸다. */
    private static final String[] DIFFICULTIES = {"Standard", "Endless", "Limited", "Timeless"};

    /** 런 시작 전(로그인·에러)에는 난이도를 아직 고르지 않았으므로 클라 기본값이 나간다. */
    private static final String DEFAULT_DIFFICULTY = "Standard";

    /** (floor-1, round-1) → 해당 층의 클리어 확률. 곱연산 시 ~7% 종합 클리어율. */
    private static final double[][] CLEAR_PROB = {
            {0.98, 0.95, 0.92},  // 1-1, 1-2, 1-3
            {0.88, 0.82, 0.75},  // 2-1, 2-2, 2-3
            {0.65, 0.55, 0.45}   // 3-1, 3-2, 3-3
    };

    private final LogService logService;
    private final Random random = new Random(42);  // 부팅마다 동일 데이터

    public DummyLogInitializer(LogService logService) {
        this.logService = logService;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<ClientLogRequest> events = new ArrayList<>();

        for (long userId = 1; userId <= USER_COUNT; userId++) {
            int loginDays = 3 + random.nextInt(13);
            for (int i = 0; i < loginDays; i++) {
                OffsetDateTime loginAt = randomTimestamp();
                events.add(login(userId, loginAt));

                int runCount = 1 + random.nextInt(3);
                OffsetDateTime runStart = loginAt.plusMinutes(1 + random.nextInt(10));
                for (int r = 0; r < runCount; r++) {
                    runStart = simulateRun(userId, runStart, events);
                }
            }
        }

        for (int i = 0; i < CLIENT_ERROR_COUNT; i++) {
            events.add(clientError(1 + random.nextInt(USER_COUNT), randomTimestamp()));
        }

        // id ASC == timestamp ASC 보장 → /users/{id}/events 의 cursor 페이징이 자연스럽게 최신순
        events.sort(Comparator.comparing(ClientLogRequest::getTimestamp));

        logService.saveAll(events);
        System.out.println("✅ Dummy events initialized: " + events.size());
    }

    /** 한 런을 시뮬레이션해서 events에 추가하고, 다음 런 시작 가능 시각 반환. */
    private OffsetDateTime simulateRun(long userId, OffsetDateTime startAt, List<ClientLogRequest> events) {
        long runId = generateMasterSeed();
        String difficulty = pick(DIFFICULTIES);   // 난이도는 런 시작 시 확정되고 런 내내 불변
        events.add(runStart(userId, startAt, runId, difficulty));

        OffsetDateTime now = startAt;
        int reachedFloor = 1, reachedRound = 1;
        long totalTimeMs = 0;
        boolean win = false;

        outer:
        for (int floor = 1; floor <= 3; floor++) {
            for (int round = 1; round <= 3; round++) {
                events.add(floorEnter(userId, now, runId, difficulty, floor, round));

                // 깊은 층일수록 더 오래 걸림: 1층 ~70~220s, 3층 ~150~300s
                long floorTimeMs = (30L + floor * 40L + random.nextInt(150)) * 1000L;
                now = now.plusSeconds(floorTimeMs / 1000);
                totalTimeMs += floorTimeMs;
                reachedFloor = floor;
                reachedRound = round;

                if (random.nextDouble() < CLEAR_PROB[floor - 1][round - 1]) {
                    int deaths = random.nextDouble() < 0.3 ? 1 + random.nextInt(2) : 0;
                    events.add(floorClear(userId, now, runId, difficulty, floor, round, floorTimeMs, deaths));
                    if (floor == 3 && round == 3) {
                        events.add(bossKill(userId, now, runId, difficulty, floor, round, floorTimeMs));
                        win = true;
                        break outer;
                    }
                } else {
                    events.add(playerDeath(userId, now, runId, difficulty, floor, round, floorTimeMs));
                    break outer;
                }
            }
        }

        events.add(runEnd(userId, now, runId, difficulty, reachedFloor, reachedRound, totalTimeMs, win));
        return now.plusMinutes(2 + random.nextInt(8));
    }

    // ---------------- 이벤트 빌더 ----------------

    private ClientLogRequest login(long userId, OffsetDateTime ts) {
        ClientLogRequest e = base(userId, "ACCOUNT_LOGIN", ts, DEFAULT_DIFFICULTY);
        e.setPayload(Map.of(
                "platform", pick(PLATFORMS),
                "clientVersion", pick(CLIENT_VERSIONS),
                "region", pick(REGIONS)
        ));
        return e;
    }

    private ClientLogRequest runStart(long userId, OffsetDateTime ts, long runId, String difficulty) {
        ClientLogRequest e = base(userId, "RUN_START", ts, difficulty);
        e.setRunId(runId);
        e.setPayload(Map.of("characterClass", pick(CHARACTER_CLASSES)));
        return e;
    }

    private ClientLogRequest floorEnter(long userId, OffsetDateTime ts, long runId, String difficulty,
                                        int floor, int round) {
        ClientLogRequest e = base(userId, "FLOOR_ENTER", ts, difficulty);
        e.setRunId(runId);
        e.setFloor(floor);
        e.setRound(String.valueOf(round));
        e.setPayload(Map.of());  // eventType + 컬럼이 전부
        return e;
    }

    private ClientLogRequest floorClear(long userId, OffsetDateTime ts, long runId, String difficulty,
                                        int floor, int round, long clearTimeMs, int deathsInFloor) {
        ClientLogRequest e = base(userId, "FLOOR_CLEAR", ts, difficulty);
        e.setRunId(runId);
        e.setFloor(floor);
        e.setRound(String.valueOf(round));
        e.setPayload(Map.of(
                "clearTimeMs", clearTimeMs,
                "deathsInFloor", deathsInFloor
        ));
        return e;
    }

    private ClientLogRequest playerDeath(long userId, OffsetDateTime ts, long runId, String difficulty,
                                         int floor, int round, long survivalMs) {
        ClientLogRequest e = base(userId, "PLAYER_DEATH", ts, difficulty);
        e.setRunId(runId);
        e.setFloor(floor);
        e.setRound(String.valueOf(round));
        // killerId가 null이라 Map.of() 못 씀 (null 불허)
        Map<String, Object> p = new HashMap<>();
        p.put("survivalTimeMs", survivalMs);
        p.put("killerId", null);
        e.setPayload(p);
        return e;
    }

    private ClientLogRequest bossKill(long userId, OffsetDateTime ts, long runId, String difficulty,
                                      int floor, int round, long clearTimeMs) {
        ClientLogRequest e = base(userId, "BOSS_KILL", ts, difficulty);
        e.setRunId(runId);
        e.setFloor(floor);
        e.setRound(String.valueOf(round));
        e.setPayload(Map.of(
                "bossId", pick(BOSSES),
                "clearTimeMs", clearTimeMs
        ));
        return e;
    }

    private ClientLogRequest runEnd(long userId, OffsetDateTime ts, long runId, String difficulty,
                                    int reachedFloor, int reachedRound, long totalTimeMs, boolean win) {
        ClientLogRequest e = base(userId, "RUN_END", ts, difficulty);
        e.setRunId(runId);
        e.setFloor(reachedFloor);   // 도달한 최종 위치 = 컬럼으로 승격
        e.setRound(String.valueOf(reachedRound));
        e.setPayload(Map.of(
                "totalTimeMs", totalTimeMs,
                "result", win ? "WIN" : "LOSE"
        ));
        return e;
    }

    private ClientLogRequest clientError(long userId, OffsetDateTime ts) {
        ClientLogRequest e = base(userId, "CLIENT_ERROR", ts, DEFAULT_DIFFICULTY);
        e.setPayload(Map.of(
                "errorCode", pick(ERROR_CODES),
                "clientVersion", pick(CLIENT_VERSIONS)
        ));
        return e;
    }

    private ClientLogRequest base(long userId, String eventType, OffsetDateTime ts, String difficulty) {
        ClientLogRequest e = new ClientLogRequest();
        e.setUserId(userId);
        e.setEventType(eventType);
        e.setTimestamp(ts);
        e.setDifficulty(difficulty);
        return e;
    }

    // ---------------- helpers ----------------

    /** 클라 SeedManager 와 같이 32bit int 범위의 시드. */
    private long generateMasterSeed() {
        return random.nextInt();
    }

    private OffsetDateTime randomTimestamp() {
        int daysAgo = pickDaysAgo();
        int hour = (random.nextDouble() < 0.6)
                ? 18 + random.nextInt(6)   // 60% 저녁 피크
                : random.nextInt(18);
        return OffsetDateTime.now()
                .minusDays(daysAgo)
                .withHour(hour)
                .withMinute(random.nextInt(60))
                .withSecond(random.nextInt(60))
                .withNano(0);
    }

    /** 40% 확률로 최근 3일, 60% 확률로 4~29일 전 → 오늘 KPI가 비지 않게. */
    private int pickDaysAgo() {
        if (random.nextDouble() < 0.4) {
            return random.nextInt(3);
        }
        return 3 + random.nextInt(DAYS_BACK - 3);
    }

    private String pick(String[] arr) {
        return arr[random.nextInt(arr.length)];
    }
}
