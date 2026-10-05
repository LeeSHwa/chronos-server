package com.chronos.server.dummyGenerator;

import com.chronos.server.dto.ClientLogRequest;
import com.chronos.server.dummyGenerator.DummyLogWriter.DummyEvent;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.TreeMap;

/**
 * 부팅 시 게임 클라이언트 로그를 시뮬레이션해 적재.
 * 명세: 클라이언트 로그 명세 v0.5
 *
 * <b>이 생성기는 명세에 적힌 이벤트·payload·발행 순서만 만든다.</b> 명세에 없는 이벤트
 * (BOSS_KILL, FLOOR_CLEAR)나 구 payload key(clearTimeMs, survivalTimeMs, deathsInFloor,
 * characterClass, roundKillCount, rewardEventCount)는 만들지 않는다. 클라이언트가 아직 이 명세대로
 * 보내지 못하는 동안, 어드민 쿼리를 "앞으로 들어올 모양"으로 검증하는 것이 이 생성기의 목적이다.
 *
 * 한 판의 흐름 (명세 4장):
 *   RUN_START → (첫 진입 리워드) → FLOOR_ENTER → ROUND_ENTER → ROUND_CLEAR
 *             → (리워드·정비) → ROUND_ENTER → … → 보스 ROUND_CLEAR → RUN_END
 *
 * 지금 층 구성: 1층은 필드 4 + 보스, 2층은 필드 1 + 보스 없음.
 * 2층 마지막 필드를 클리어하고 포탈을 타면 그 판은 WIN으로 끝난다.
 *
 * ⚠️ local 프로파일에서만 동작한다.
 *    PostgreSQL은 H2(인메모리)와 달리 데이터가 영구 보존되므로, 게이트가 없으면
 *    부팅할 때마다 1만여 건이 계속 누적된다. 전시·운영 빌드에서는 프로파일을 켜지 말 것.
 */
@Component
@Profile("local")
public class DummyLogInitializer implements ApplicationRunner {

    // ─────────────────────────────────────────────
    // 시뮬레이션 규모
    // ─────────────────────────────────────────────

    private static final int USER_COUNT = 50;
    private static final int DAYS_BACK = 30;
    private static final int CLIENT_ERROR_COUNT = 15;

    /** 층 구성: {필드 수, 보스 유무}. FLOOR_ENTER의 fieldCount / hasBoss 와 같은 값. */
    private static final int[] FIELD_COUNT = {4, 1};
    private static final boolean[] HAS_BOSS = {true, false};
    private static final int FLOOR_COUNT = FIELD_COUNT.length;

    /** 스테이지별 클리어 확률. 뒤로 갈수록 떨어진다. 종합 클리어율 ~15%. */
    private static final double[][] CLEAR_PROB = {
            {0.97, 0.94, 0.90, 0.86, 0.45},  // 1-1 ~ 1-4, 1-B
            {0.62}                            // 2-1
    };

    /** 스테이지를 깬 뒤 포탈 앞에서 판을 접을 확률 (RUN_END QUIT). */
    private static final double QUIT_PROB = 0.04;
    /** 판 도중 게임을 그냥 꺼버릴 확률. RUN_END 없이 끊기고, 다음 접속 때 RUN_RESUME으로 이어진다. */
    private static final double ABANDON_PROB = 0.03;

    // ─────────────────────────────────────────────
    // 값 목록 — 전부 클라이언트 실제 값
    // ─────────────────────────────────────────────

    /** 클라 DifficultyTier enum 이름. 엔벨로프는 이 문자열을 그대로 보낸다. */
    private static final String[] DIFFICULTIES = {"Standard", "Endless", "Limited", "Timeless"};

    /** 런 시작 전(로그인·에러)에는 난이도를 아직 고르지 않았으므로 클라 기본값이 나간다. */
    private static final String DEFAULT_DIFFICULTY = "Standard";

    private static final String[] CLIENT_VERSIONS = {"1.2.1", "1.2.2", "1.2.3"};
    private static final String[] ERROR_CODES = {"ERR_PHYSICS_OVERLAP", "ERR_SYNC_TIMEOUT", "ERR_ASSET_LOAD"};
    private static final String[] ERROR_MESSAGES = {
            "NullReferenceException at StageRuntimeManager.Tick",
            "Timeout while waiting for save flush",
            "Failed to load addressable: F1_B"
    };

    /**
     * 로비에서 고르는 공격 타입. 기본값은 산탄(SPECIAL_SHOT)이라 그 비중을 높게 둔다.
     * 각 타입은 대응하는 전투 증강이 빌드에 같이 잡힌다.
     */
    private static final String[] ATTACK_TYPES = {"SPECIAL_SHOT", "PRECISION_TARGETING", "CONVERSION"};
    private static final double[] ATTACK_TYPE_WEIGHT = {0.5, 0.25, 0.25};
    private static final Map<String, Integer> BRANCH_AUGMENT = Map.of(
            "CONVERSION", 10,
            "PRECISION_TARGETING", 11,
            "SPECIAL_SHOT", 12
    );

    /** 1층 필드 맵. 판마다 순서가 섞인다 — mapId와 round를 나눠 기록하는 이유. */
    private static final String[] FLOOR1_FIELD_MAPS = {"F1_1", "F1_2", "F1_3", "F1_4"};
    private static final String FLOOR1_BOSS_MAP = "F1_B";
    private static final String[] FLOOR2_FIELD_MAPS = {"F2_1"};

    /** 무기 templateId. 11001 학살 ~ 11006 태초의 의지. */
    private static final int[] WEAPON_TEMPLATES = {11001, 11002, 11003, 11004, 11005, 11006};
    /** 룬 templateId. 0~2번 칸은 1성(계절의 파편), 3번 칸은 2성(강력한 계절의 파편) 전용. */
    private static final int RUNE_TEMPLATE_T1 = 21001;
    private static final int RUNE_TEMPLATE_T2 = 21002;

    /** 상태가 남는 증강 id. 전투 갈래(10·11·12)는 공격 타입에서 따로 들어간다. */
    private static final int[] AUGMENT_POOL = {4, 5, 6, 8, 9, 14, 15, 21, 22, 31, 32};

    /** 적 id. killerId에 들어간다. 층마다 나오는 적이 다르다. */
    private static final int[] ENEMY_FLOOR1 = {2001, 2002, 2003, 2010};
    private static final int[] ENEMY_FLOOR2 = {3001, 3002, 3010};
    private static final int ENEMY_BOSS = 2100;

    private static final String[] RUNE_SEASONS = {"SPRING", "SUMMER", "AUTUMN", "WINTER"};
    private static final String[] WEAPON_RANKS = {"C", "B", "A", "S"};

    // ─────────────────────────────────────────────
    // OC(오버클럭) 모델 — 단위는 0.1초(deciseconds)
    // ─────────────────────────────────────────────

    /** 판 시작 시 OC 잔량. 60초. */
    private static final int INITIAL_OC = 600;

    /**
     * 스테이지에 들어갈 때 주는 라운드 지급분. 난이도 테이블 값(초 → 0.1초 단위).
     *
     * 지급 규칙은 클라의 것이고 로그는 여기에 끼지 않는다. 생성기는 "클라가 이렇게 준다"를
     * 흉내 내기만 하고, 로그에는 그 결과인 OC 잔량만 적는다.
     * ROUND_ENTER 시점에는 아직 들어오기 전, ROUND_CLEAR 시점에는 이미 들어온 뒤다.
     */
    private static final Map<String, Integer> OC_GRANT = Map.of(
            "Endless", 1800,
            "Standard", 1200,
            "Limited", 900,
            "Timeless", 600
    );

    /** 아무리 잘해도 무한히 쌓이진 않는다. 240초. */
    private static final int OC_CAP = 2400;

    private final DummyLogWriter writer;
    private final Random random = new Random(42);  // 부팅마다 동일 데이터

    public DummyLogInitializer(DummyLogWriter writer) {
        this.writer = writer;
    }

    // ─────────────────────────────────────────────

    @Override
    public void run(ApplicationArguments args) {
        List<DummyEvent> events = new ArrayList<>();

        for (long userId = 1; userId <= USER_COUNT; userId++) {
            simulateUser(userId, events);
        }

        for (int i = 0; i < CLIENT_ERROR_COUNT; i++) {
            long userId = 1 + random.nextInt(USER_COUNT);
            events.add(event(clientError(userId, randomSessionStart())));
        }

        // id ASC == 발행 순서가 되도록 시각으로 정렬한다.
        // 같은 시각이면 넣은 순서가 유지된다(List.sort는 안정 정렬) → PLAYER_DEATH 다음에 RUN_END.
        events.sort(Comparator.comparing((DummyEvent e) -> e.log().getTimestamp()));

        writer.write(events);
        System.out.println("✅ Dummy events initialized: " + events.size());
        System.out.println("   " + summarize(events));
    }

    /** 한 유저의 전체 플레이 이력. 접속일마다 세션을 하나씩 만든다. */
    private void simulateUser(long userId, List<DummyEvent> events) {
        int sessionCount = 3 + random.nextInt(13);

        List<OffsetDateTime> sessionStarts = new ArrayList<>();
        for (int i = 0; i < sessionCount; i++) {
            sessionStarts.add(randomSessionStart());
        }
        sessionStarts.sort(Comparator.naturalOrder());

        RunState pending = null;   // 지난 세션에서 RUN_END 없이 끊긴 판

        for (OffsetDateTime sessionStart : sessionStarts) {
            Clock clock = new Clock(sessionStart);
            events.add(event(accountLogin(userId, clock.now())));
            clock.advanceSeconds(20 + random.nextInt(100));   // 메뉴에서 머무는 시간

            // 이어하기: 마지막 세이브(= 마지막 ROUND_ENTER)의 스테이지 처음부터 다시 시작한다.
            // 그 스테이지의 ROUND_ENTER는 다시 나가지 않는다(명세 4.5).
            if (pending != null) {
                events.add(event(runResume(pending, clock.now())));
                pending = playRun(pending, clock, events, false);
                clock.advanceSeconds(60 + random.nextInt(300));
            }

            if (pending != null) continue;   // 또 끊겼으면 다음 세션으로 넘긴다

            int runCount = 1 + random.nextInt(3);
            for (int i = 0; i < runCount && pending == null; i++) {
                RunState state = new RunState(userId, nextRunId(), pick(DIFFICULTIES),
                        pick(CLIENT_VERSIONS), pickAttackType());
                pending = playRun(state, clock, events, true);
                clock.advanceSeconds(60 + random.nextInt(600));
            }
        }
    }

    /**
     * 판 하나를 현재 위치부터 끝까지 진행한다.
     *
     * @param fresh true면 새 판(RUN_START부터), false면 이어하기(진행 중이던 스테이지의 클리어부터)
     * @return RUN_END 없이 끊겼으면 그 시점의 상태, 정상적으로 끝났으면 null
     */
    private RunState playRun(RunState s, Clock clock, List<DummyEvent> events, boolean fresh) {
        if (fresh) {
            events.add(event(runStart(s, clock.now())));

            // 첫 진입 리워드. 이걸 고른 뒤에 FLOOR_ENTER·ROUND_ENTER가 나간다.
            clock.advanceSeconds(8 + random.nextInt(20));
            s.takeReward();
            events.add(event(floorEnter(s, clock.now())));
            events.add(event(roundEnter(s, clock.now())));
        }

        while (true) {
            boolean boss = s.isBossStage();

            // 라운드 지급분이 들어온다. 필드는 첫 입력, 보스는 씬 진입 직후 — 둘 다 ROUND_ENTER 뒤다.
            int grant = OC_GRANT.getOrDefault(s.difficulty, 600);
            s.oc = Math.min(s.oc + grant, OC_CAP);

            // 스테이지에 걸리는 시간은 지급량에 비례시킨다.
            // 고정 범위로 두면 지급이 적은 난이도(Timeless 60초)에서 소모가 늘 지급을 넘어,
            // 두 스테이지 만에 OC가 하한에 붙고 "진입 OC" 지표가 전부 같은 값이 된다.
            int budgetSec = grant / 10;
            int durationSec = (int) (budgetSec * (0.5 + random.nextDouble() * 0.6) * (boss ? 1.4 : 1.0));

            int drain = durationSec * 10;                        // 시간이 흐른 만큼 깎인다
            int combat = boss ? 80 + random.nextInt(260) : random.nextInt(180);

            clock.advanceSeconds(durationSec);
            s.elapsedMs += durationSec * 1000L;

            if (random.nextDouble() >= CLEAR_PROB[s.floorIndex][s.stageIndex]) {
                // ── 사망: OC가 0이 되어 끝난다 ──
                s.oc = 0;
                s.takeSnapshot();                      // 죽은 순간의 스펙
                String cause = deathCause(boss, s.difficulty);
                events.add(event(playerDeath(s, clock.now(), cause, killerId(s, boss, cause))));
                clock.advanceMillis(50);
                events.add(event(runEnd(s, clock.now(), "DEATH")));
                return null;
            }

            // ── 클리어 ──
            // 이 순간의 시간·OC를 적어두기만 한다. ROUND_CLEAR는 리워드·정비가 끝난
            // Save 시점에 나가고, 그때 이 스냅샷을 실어 보낸다(명세 3.3).
            s.oc = Math.max(s.oc - drain - combat, 20);
            s.clearElapsedMs = s.elapsedMs;
            s.clearOc = s.oc;
            s.takeSnapshot();                          // 리워드·정비 전의 스펙

            if (s.isLastStageOfRun()) {
                // 마지막 스테이지는 다음 스테이지가 없으므로 쓰러뜨린 순간 바로 나간다.
                events.add(event(roundClear(s, clock.now())));
                clock.advanceSeconds(5 + random.nextInt(10));
                events.add(event(runEnd(s, clock.now(), "WIN")));
                return null;
            }

            // ── 포탈 → 리워드·정비 → Save(ROUND_CLEAR) → 다음 스테이지 ──
            // 리워드를 고르기 전에 접거나 끄면 그 스테이지의 ROUND_CLEAR는 나가지 않는다.
            if (random.nextDouble() < QUIT_PROB) {
                clock.advanceSeconds(5 + random.nextInt(30));
                events.add(event(runEnd(s, clock.now(), "QUIT")));
                return null;
            }
            if (random.nextDouble() < ABANDON_PROB) {
                return s;   // 게임을 그냥 껐다. RUN_END 없이 끊긴다.
            }

            clock.advanceSeconds(15 + random.nextInt(45));   // 리워드 고르고 정비하는 시간
            s.takeReward();
            events.add(event(roundClear(s, clock.now())));   // Save 시점

            boolean floorChanged = s.advanceStage();
            if (floorChanged) {
                events.add(event(floorEnter(s, clock.now())));
            }
            events.add(event(roundEnter(s, clock.now())));
        }
    }

    // ─────────────────────────────────────────────
    // 이벤트 빌더 — payload key는 명세 v0.5 그대로
    // ─────────────────────────────────────────────

    private ClientLogRequest accountLogin(long userId, OffsetDateTime ts) {
        ClientLogRequest e = base(userId, "ACCOUNT_LOGIN", ts, DEFAULT_DIFFICULTY);
        e.setPayload(payload(
                "platform", "PC",
                "clientVersion", pick(CLIENT_VERSIONS),
                "region", "KR"
        ));
        return e;
    }

    private ClientLogRequest runStart(RunState s, OffsetDateTime ts) {
        ClientLogRequest e = base(s.userId, "RUN_START", ts, s.difficulty);
        e.setRunId(s.runId);   // floor·round 없음
        e.setPayload(payload(
                "attackType", s.attackType,
                "clientVersion", s.clientVersion
        ));
        return e;
    }

    private ClientLogRequest runResume(RunState s, OffsetDateTime ts) {
        ClientLogRequest e = stageBase(s, "RUN_RESUME", ts);
        e.setPayload(payload(
                "elapsedMs", s.elapsedMs,
                "overclockDeciseconds", s.oc
        ));
        return e;
    }

    private ClientLogRequest runEnd(RunState s, OffsetDateTime ts, String result) {
        ClientLogRequest e = stageBase(s, "RUN_END", ts);
        e.setPayload(payload(
                "result", result,
                "elapsedMs", s.elapsedMs,
                "overclockDeciseconds", s.oc,
                "build", s.snapshot        // 그 판에서 마지막으로 찍힌 스냅샷
        ));
        return e;
    }

    private ClientLogRequest floorEnter(RunState s, OffsetDateTime ts) {
        ClientLogRequest e = stageBase(s, "FLOOR_ENTER", ts);
        e.setPayload(payload(
                "fieldCount", FIELD_COUNT[s.floorIndex],
                "hasBoss", HAS_BOSS[s.floorIndex]
        ));
        return e;
    }

    private ClientLogRequest roundEnter(RunState s, OffsetDateTime ts) {
        ClientLogRequest e = stageBase(s, "ROUND_ENTER", ts);
        e.setPayload(payload(
                "mapId", s.currentMapId(),
                "elapsedMs", s.elapsedMs,
                "overclockDeciseconds", s.oc
        ));
        return e;
    }

    /**
     * 클리어 순간의 시간·OC는 그때 찍어둔 스냅샷을 쓴다. 이 이벤트 자체는 리워드·정비가
     * 끝난 Save 시점에 나가므로, 현재 시각과 payload의 시간이 서로 다른 유일한 이벤트다.
     */
    private ClientLogRequest roundClear(RunState s, OffsetDateTime ts) {
        ClientLogRequest e = stageBase(s, "ROUND_CLEAR", ts);
        e.setPayload(payload(
                "clearElapsedMs", s.clearElapsedMs,
                "clearOverclockDeciseconds", s.clearOc,
                "build", s.snapshot
        ));
        return e;
    }

    /** killerId는 가해자가 있을 때만. 시간 소진(DRAIN)으로 죽으면 키 자체를 넣지 않는다. */
    private ClientLogRequest playerDeath(RunState s, OffsetDateTime ts, String cause, Integer killerId) {
        ClientLogRequest e = stageBase(s, "PLAYER_DEATH", ts);
        Map<String, Object> p = payload(
                "deathCause", cause,
                "elapsedMs", s.elapsedMs
        );
        if (killerId != null) p.put("killerId", killerId);
        p.put("build", s.snapshot);
        e.setPayload(p);
        return e;
    }

    private ClientLogRequest clientError(long userId, OffsetDateTime ts) {
        ClientLogRequest e = base(userId, "CLIENT_ERROR", ts, DEFAULT_DIFFICULTY);
        int i = random.nextInt(ERROR_CODES.length);
        e.setPayload(payload(
                "errorCode", ERROR_CODES[i],
                "message", ERROR_MESSAGES[i],
                "clientVersion", pick(CLIENT_VERSIONS)
        ));
        return e;
    }

    /** runId·floor·round가 모두 붙는 이벤트의 공통 부분. */
    private ClientLogRequest stageBase(RunState s, String eventType, OffsetDateTime ts) {
        ClientLogRequest e = base(s.userId, eventType, ts, s.difficulty);
        e.setRunId(s.runId);
        e.setFloor(s.floorIndex + 1);
        e.setRound(s.roundLabel());
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

    /** 클라 배치 주기가 15초라, 수신은 발행보다 0~15초 늦는다. */
    private DummyEvent event(ClientLogRequest log) {
        return new DummyEvent(log, log.getTimestamp().plusSeconds(random.nextInt(16)));
    }

    // ─────────────────────────────────────────────
    // 런 상태
    // ─────────────────────────────────────────────

    /**
     * 판 하나가 진행되는 동안 유지되는 값.
     *
     * 이어하기로 세션을 넘어가도 그대로 쓰이므로, 누적 시간·OC·빌드가 이어서 계산된다.
     */
    private final class RunState {
        final long userId;
        final long runId;
        final String difficulty;
        final String clientVersion;
        final String attackType;

        /** 판마다 섞이는 1층 필드 맵 순서. "몇 번째 자리에 어떤 맵이 왔는가"가 판마다 다르다. */
        final List<String> floor1Maps = new ArrayList<>(List.of(FLOOR1_FIELD_MAPS));

        int floorIndex = 0;    // 0 = 1층
        int stageIndex = 0;    // 그 층에서 몇 번째 스테이지인가. 필드 다음이 보스
        long elapsedMs = 0;
        int oc = INITIAL_OC;
        long clearElapsedMs = 0;   // 직전에 깬 스테이지의 클리어 순간 값
        int clearOc = INITIAL_OC;

        /**
         * 전투가 끝난 순간에 찍어 얼려 두는 빌드 사본(명세 3.5).
         * 리워드·정비로는 갱신하지 않으므로, 로그에는 "그 스펙으로 어디까지 해냈는가"가 남는다.
         */
        Map<String, Object> snapshot = Map.of("weapons", List.of(), "runes", List.of(), "augments", List.of());
        int rewardCount = 0;   // 빌드가 자라는 속도를 정하는 내부 값 (로그에는 나가지 않는다)

        // 빌드: 리워드를 받을 때마다 자란다
        final Map<Integer, int[]> weapons = new TreeMap<>();    // slot → {templateId, rankIndex}
        final Map<Integer, int[]> runes = new TreeMap<>();      // slot → {templateId, seasonIndex, fusionStack}
        final Map<Integer, Integer> augments = new TreeMap<>(); // augmentId → stacks

        RunState(long userId, long runId, String difficulty, String clientVersion, String attackType) {
            this.userId = userId;
            this.runId = runId;
            this.difficulty = difficulty;
            this.clientVersion = clientVersion;
            this.attackType = attackType;
            Collections.shuffle(floor1Maps, random);
        }

        /** 그 층의 스테이지 수 = 필드 수 + 보스(있으면). */
        int stageCount(int floor) {
            return FIELD_COUNT[floor] + (HAS_BOSS[floor] ? 1 : 0);
        }

        boolean isBossStage() {
            return HAS_BOSS[floorIndex] && stageIndex == FIELD_COUNT[floorIndex];
        }

        boolean isLastStageOfRun() {
            return floorIndex == FLOOR_COUNT - 1 && stageIndex == stageCount(floorIndex) - 1;
        }

        /** 보스는 "B", 필드는 지나간 순서대로 "1"부터. */
        String roundLabel() {
            return isBossStage() ? "B" : String.valueOf(stageIndex + 1);
        }

        String currentMapId() {
            if (isBossStage()) return FLOOR1_BOSS_MAP;
            return floorIndex == 0 ? floor1Maps.get(stageIndex) : FLOOR2_FIELD_MAPS[stageIndex];
        }

        /** 다음 스테이지로. 층이 바뀌면 true를 돌려준다(FLOOR_ENTER 발행 조건). */
        boolean advanceStage() {
            stageIndex++;
            if (stageIndex < stageCount(floorIndex)) return false;
            floorIndex++;
            stageIndex = 0;
            return true;
        }

        /** 리워드 한 번. 무기·룬·증강 중 하나가 늘거나 좋아진다. */
        void takeReward() {
            rewardCount++;
            double roll = random.nextDouble();

            if (roll < 0.40) {
                int slot = random.nextInt(weapons.size() < 4 ? 4 : 5);
                int[] cur = weapons.get(slot);
                // 이미 있는 칸이면 등급이 오르고, 빈 칸이면 새로 장착한다.
                int rankIndex = cur == null
                        ? Math.min(random.nextInt(2) + rewardCount / 4, WEAPON_RANKS.length - 1)
                        : Math.min(cur[1] + 1, WEAPON_RANKS.length - 1);
                weapons.put(slot, new int[]{cur == null ? pick(WEAPON_TEMPLATES) : cur[0], rankIndex});
            } else if (roll < 0.70) {
                int slot = random.nextInt(4);
                int[] cur = runes.get(slot);
                if (cur == null) {
                    // 3번 칸은 2성 전용, 0~2번은 1성. fusionStack은 1부터 시작한다.
                    runes.put(slot, new int[]{slot == 3 ? RUNE_TEMPLATE_T2 : RUNE_TEMPLATE_T1,
                            random.nextInt(RUNE_SEASONS.length), 1});
                } else {
                    cur[2] = Math.min(cur[2] + 1, 3);
                }
            } else if (roll < 0.85) {
                // 공격 타입에 대응하는 전투 갈래 증강. 최대 3스택까지 오른다.
                augments.merge(BRANCH_AUGMENT.get(attackType), 1, (a, b) -> Math.min(a + b, 3));
            } else {
                augments.merge(pick(AUGMENT_POOL), 1, (a, b) -> Math.min(a + b, 3));
            }
        }

        /** 지금 상태로 스냅샷을 새로 찍는다. 전투가 끝난 순간에만 부른다. */
        void takeSnapshot() {
            snapshot = build();
        }

        /** 장착한 무기·룬과 보유 증강. 가방에 든 것은 담지 않는다. */
        Map<String, Object> build() {
            List<Map<String, Object>> w = new ArrayList<>();
            weapons.forEach((slot, v) -> w.add(payload(
                    "slot", slot, "templateId", v[0], "rank", WEAPON_RANKS[v[1]])));

            List<Map<String, Object>> r = new ArrayList<>();
            runes.forEach((slot, v) -> r.add(payload(
                    "slot", slot, "templateId", v[0],
                    "season", RUNE_SEASONS[v[1]], "fusionStack", v[2])));

            List<Map<String, Object>> a = new ArrayList<>();
            augments.forEach((id, stacks) -> a.add(payload("augmentId", id, "stacks", stacks)));

            return payload("weapons", w, "runes", r, "augments", a);
        }
    }

    /** 이벤트 시각을 앞으로만 밀어주는 커서. */
    private static final class Clock {
        private OffsetDateTime now;

        Clock(OffsetDateTime start) { this.now = start; }

        OffsetDateTime now() { return now; }
        void advanceSeconds(int sec) { now = now.plusSeconds(sec); }
        void advanceMillis(int ms) { now = now.plusNanos(ms * 1_000_000L); }
    }

    // ─────────────────────────────────────────────
    // helpers
    // ─────────────────────────────────────────────

    /**
     * key-value를 번갈아 받아 Map으로. 순서가 유지돼 JSON도 명세 표 순서대로 나온다.
     * (Map.of는 null을 못 담고 순서도 섞이므로 쓰지 않는다. 명세상 값이 없으면 key를 생략한다.)
     */
    private static Map<String, Object> payload(Object... kv) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            map.put((String) kv[i], kv[i + 1]);
        }
        return map;
    }

    /**
     * 사망 원인.
     *
     * REFLECT(보스 돌진 반사)는 Timeless 난이도의 보스 스테이지에서만 성립한다.
     */
    private String deathCause(boolean boss, String difficulty) {
        double roll = random.nextDouble();
        if (boss && "Timeless".equals(difficulty) && roll < 0.18) return "REFLECT";
        return roll < 0.60 ? "COMBAT" : "DRAIN";
    }

    /** 가해자. 시간 소진으로 죽으면 없다. */
    private Integer killerId(RunState s, boolean boss, String cause) {
        if ("DRAIN".equals(cause)) return null;
        if (boss) return ENEMY_BOSS;
        return s.floorIndex == 0 ? pick(ENEMY_FLOOR1) : pick(ENEMY_FLOOR2);
    }

    private String pickAttackType() {
        double roll = random.nextDouble();
        double acc = 0;
        for (int i = 0; i < ATTACK_TYPES.length; i++) {
            acc += ATTACK_TYPE_WEIGHT[i];
            if (roll < acc) return ATTACK_TYPES[i];
        }
        return ATTACK_TYPES[0];
    }

    /** 클라 SeedManager 와 같이 32bit int 범위의 시드를 runId로 쓴다. */
    private long nextRunId() {
        return random.nextInt();
    }

    private OffsetDateTime randomSessionStart() {
        int daysAgo = pickDaysAgo();
        int hour = (random.nextDouble() < 0.6)
                ? 18 + random.nextInt(6)   // 60% 저녁 피크
                : random.nextInt(18);

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime start = now
                .minusDays(daysAgo)
                .withHour(hour)
                .withMinute(random.nextInt(60))
                .withSecond(random.nextInt(60))
                .withNano(0);

        // 오늘 날짜에 시(hour)만 바꿔 꽂으면 아직 오지 않은 시각이 나온다(지금 14시인데 20시 세션).
        // 그대로 두면 미래 시각 로그가 생겨 "최근 접속 유저"가 전부 방금 전으로 보이고,
        // 수신 시각으로 집계하는 지표가 내일 칸까지 침범한다. 하루 앞으로 당겨 과거로 만든다.
        // 세션 하나가 몇 시간 이어질 수 있으므로 끝까지 과거가 되도록 여유를 둔다.
        while (start.isAfter(now.minusHours(2))) {
            start = start.minusDays(1);
        }
        return start;
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

    private int pick(int[] arr) {
        return arr[random.nextInt(arr.length)];
    }

    /** 생성 결과를 이벤트 타입별로 세서 한 줄로 찍는다. 명세대로 나왔는지 눈으로 확인하는 용도. */
    private String summarize(List<DummyEvent> events) {
        Map<String, Integer> count = new TreeMap<>();
        for (DummyEvent e : events) {
            count.merge(e.log().getEventType(), 1, Integer::sum);
        }
        return count.toString();
    }
}
