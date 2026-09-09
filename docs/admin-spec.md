# Chronos Admin 화면 & API 명세 v1

이 문서는 **프론트(Chronos-Admin-Web) 세션에 그대로 전달**할 수 있는 형태로 작성됨.
화면 구성과 API 응답 스키마를 한 세트로 정의.

작성 기준일: 2026-05-17
선행 문서: [client-log-spec.md](./client-log-spec.md)

---

## 0. 사이드바 (V1 최종)

```
개요
  └ 대시보드
유저
  └ 유저 검색
게임 데이터
  └ 플레이 통계
시스템
  └ 서버 상태
```

**제거된 메뉴 (V1 스코프 외):**
- 전체 유저, 정지/제재 → 인증/회원 도메인 미구현
- 로그 확인 → 디버그용, 진짜 필요할 때 추가
- 공지/점검 → 모델 없음
- 랭킹/리더보드 → 점수 모델 미정

---

## 1. 화면: 대시보드 (슬림)

운영자가 첫 화면에서 *"오늘 게임이 건강한가?"* 만 보면 끝나는 화면.

**구성요소:**
- **상단 검색바**: userId 입력 → 유저 디테일 페이지로 이동
- **KPI 카드 3개**:
  1. 오늘 접속자 (DAU)
  2. 오늘 시작된 런 수
  3. 오늘 완주된 런 수 (= RUN_END.result=WIN)
- **DAU 시계열 라인차트** (최근 14일)
- **최근 접속 유저 리스트** (10개, userId / 마지막 활동시각 / 런 수)

**API 호출:** `GET /api/admin/stats/overview` 1회로 충분

---

## 2. 화면: 플레이 통계

**메인 차트 (이 화면의 핵심): 층별 클리어율 곡선**
- X축: 층-라운드 라벨 (`1-1`, `1-2`, ..., `3-3`)
- Y축: 클리어율 (%)
- 라인 2개:
  - **클리어율** = `FLOOR_CLEAR 수 / FLOOR_ENTER 수` (해당 floor-round 기준)
  - **도달율** = `FLOOR_ENTER 수 / 전체 RUN_START 수`
- 보조 정보: 마우스 오버 시 평균 클리어 시간 / 평균 사망 횟수

**보조 테이블: 층별 통계**
| 층 | 도달 런 | 클리어 런 | 클리어율 | 평균 클리어시간 | 평균 사망 |
|---|---|---|---|---|---|

**필터:** 기간 (오늘 / 7일 / 30일 토글)

**API 호출:** `GET /api/admin/stats/floors?from=&to=`

---

## 3. 화면: 유저 디테일 (대시보드 검색 결과)

**요약 카드 (상단):**
- 총 런 수
- 최고 도달 (예: `3-2`)
- 마지막 접속 시각
- 평균 런 시간
- 완주율 (`WIN / 전체 런`)

**최근 이벤트 테이블 (하단):**
- 시간순 내림차순, 50건씩 cursor 페이징
- 컬럼: 시각 / 이벤트타입 / runId / floor-round / payload 요약

**API 호출:**
- `GET /api/admin/users/{userId}` (요약)
- `GET /api/admin/users/{userId}/events?cursor=&limit=50` (테이블)

---

## 4. API 엔드포인트 명세

모든 응답은 `application/json`. CORS는 클래스 레벨 `*` 유지 (V2에서 도메인 제한).

### 4.1 `GET /api/admin/stats/overview`

**Query:** 없음

**Response 200:**
```json
{
  "dauToday": 350,
  "runsStartedToday": 47,
  "runsClearedToday": 8,
  "dauSeries": [
    { "date": "2026-05-04", "dau": 312 },
    { "date": "2026-05-05", "dau": 298 },
    { "date": "2026-05-17", "dau": 350 }
  ],
  "recentUsers": [
    { "userId": 25, "lastSeenAt": "2026-05-17T10:02:00", "runCount": 4, "isOnline": true },
    { "userId": 13, "lastSeenAt": "2026-05-15T22:11:00", "runCount": 3, "isOnline": false }
  ]
}
```

**산정 로직:**
- `dauToday` = `COUNT(DISTINCT user_id) WHERE event_type='ACCOUNT_LOGIN' AND DATE(timestamp)=today`
- `runsStartedToday` = `COUNT(*) WHERE event_type='RUN_START' AND DATE(timestamp)=today`
- `runsClearedToday` = `COUNT(*) WHERE event_type='RUN_END' AND payload->>'result'='WIN' AND DATE(timestamp)=today`
- `isOnline` = 최근 5분 내 이벤트 존재 여부

### 4.2 `GET /api/admin/stats/floors?from=&to=`

**Query:**
| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `from` | ISO date | 7일 전 | 시작일 (포함) |
| `to`   | ISO date | 오늘 | 종료일 (포함) |

**Response 200:**
```json
{
  "totalRuns": 120,
  "floors": [
    {
      "floor": 1, "round": 1, "label": "1-1",
      "entered": 120, "cleared": 118, "clearRate": 0.9833,
      "avgClearMs": 42000, "avgDeaths": 0.1
    },
    {
      "floor": 1, "round": 2, "label": "1-2",
      "entered": 118, "cleared": 95, "clearRate": 0.8051,
      "avgClearMs": 65000, "avgDeaths": 0.4
    }
  ]
}
```

### 4.3 `GET /api/admin/users/search?q={userIdPrefix}`

**Query:**
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `q` | string | ✅ | userId prefix (예: `"12"` → 12, 120, 125…) |

**Response 200:**
```json
{
  "results": [
    { "userId": 25, "runCount": 4, "lastSeenAt": "2026-05-17T10:02:00" }
  ]
}
```

**메모:** 현재 데이터 모델에 닉네임 없음 → ID 기반 검색만. 닉네임 검색은 회원 도메인 도입 후.

### 4.4 `GET /api/admin/users/{userId}`

**Path:** `userId` (long)

**Response 200:**
```json
{
  "userId": 25,
  "totalRuns": 12,
  "maxFloorReached": { "floor": 3, "round": 2, "label": "3-2" },
  "lastSeenAt": "2026-05-17T10:02:00",
  "avgRunTimeMs": 845000,
  "winRate": 0.0833
}
```

**Response 404:** 해당 userId 이벤트 없음

### 4.5 `GET /api/admin/users/{userId}/events?cursor=&limit=50`

**Query:**
| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `cursor` | string (event id) | null | 이전 응답의 `nextCursor` |
| `limit`  | int | 50 | 최대 100 |

**Response 200:**
```json
{
  "events": [
    {
      "id": 91823,
      "eventType": "FLOOR_CLEAR",
      "timestamp": "2026-05-17T10:01:30",
      "runId": 1842937561,
      "floor": 2, "round": 3,
      "payload": { "clearTimeMs": 78400, "deathsInFloor": 0 }
    }
  ],
  "nextCursor": "91773"
}
```
`nextCursor` 가 null이면 끝.

### 4.6 `GET /api/admin/server/status` (기존 유지)

```json
{ "status": "HEALTHY", "version": "v1.0.0", "lastSyncAt": "2026-05-17T10:03:09" }
```

---

## 5. 제거 대상 (구현 시 함께 삭제)

| 경로 | 사유 |
|---|---|
| `GET /api/admin/dashboard/summary` | overview 로 대체 |
| `GET /api/admin/dashboard/system-stats` | V1 스코프 외 |
| `GET /api/admin/users/recent` | overview 안에 흡수 |
| `GET /api/admin/ops-notes` | 모델 없음 |
| `GET /api/v1/logs` | 디버그용, index.html 삭제됨 |

코드 청소 대상:
- `LogConfig.java` (전체 주석)
- `MemoryLogRepository.java` (미사용)
- `DashboardSummaryDto`, `SystemStatsDto`, `RecentUserDto` → overview 응답 DTO로 통합

---

## 6. 회의 데모 시나리오 (2026-05-18)

1. 부팅 → 신규 명세 형식으로 `DummyLogInitializer` 가 750건 적재
2. IntelliJ http / Postman 으로 위 6개 엔드포인트 응답 캡처
3. *"프론트가 이 명세대로 화면 그리면 다음 화면이 나옵니다"* (Figma or 손그림)
4. **다음 마일스톤 슬라이드**: GCP 배포 + API 인증 + 정지/제재 모델 + 닉네임 검색
