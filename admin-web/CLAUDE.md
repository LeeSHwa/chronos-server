# Chronos Admin Dashboard — 프론트엔드 가이드

## 프로젝트 개요
로그라이크 게임 "Chronos"의 관리자 대시보드.
백엔드: Spring Boot (Java) / 이 폴더는 순수 프론트엔드(Vanilla JS + Tailwind)만 담당.

## 기술 스택
- 순수 HTML5 / CSS / Vanilla JS (프레임워크, 번들러 없음)
- Tailwind CSS (CDN)
- 백엔드 URL: `http://localhost:8080` (상수 `BASE_URL`로 관리)

## 백엔드 개발 단계 (현 위치 파악용)
1단계 (현재) : Spring Boot 더미 컨트롤러 (하드코딩 JSON 반환)
2단계        : H2 인메모리 DB + JdbcTemplate
3단계        : PostgreSQL + JdbcTemplate

## 코딩 규칙 및 UI 전략
- 한국어 주석 필수
- index.html의 기능을 한 번에 구현하지 않고 섹션 단위로 해금.
- 기존 작동 중인 코드는 명시적 요청 없이 리팩토링/수정 금지.
- async/await + fetch API 사용
- innerHTML 삽입 시 반드시 `escHtml()`로 XSS 방어 적용
- 에러 발생 시 방어 로직(skeleton UI 유지, 빈 배열 처리 등) 작성

## 절대 하지 말 것 (에이전트 제약 사항)
- 백엔드(Spring) 코드 작성 또는 수정 제안.
- React, Vue, npm, Webpack 등 프레임워크/빌드 도구 도입.
- 사용자 지시 없이 임의로 CSS/JS 파일 분리.

---

## 📄 [필독] 백엔드 API 명세 (API Contract)
프론트엔드는 반드시 아래 응답 구조에 맞춰 렌더링 로직을 작성해야 한다.

### 1. 서버 상태 (`GET /api/admin/server/status`)
```json
{
  "status": "HEALTHY",
  "version": "v1.0.0",
  "lastSyncAt": "2026-05-01T12:00:00Z"
}
```
- `status`: `"HEALTHY"` | `"DEGRADED"` | `"DOWN"`

### 2. 대시보드 요약 (`GET /api/admin/dashboard/summary`)
```json
{
  "totalUsers": 1500,
  "totalUsersDelta": 12,
  "dau": 350,
  "dauDeltaPct": 5.2,
  "concurrentUsers": 42,
  "newSignupsToday": 8,
  "newSignupsDelta": -2
}
```

### 3. 시스템 통계 (`GET /api/admin/dashboard/system-stats`)
```json
{
  "avgRunTimeSeconds": 850,
  "totalRunsToday": 1200,
  "avgClearRatePct": 15.5,
  "errorLogs24h": 3,
  "pendingReports": 1,
  "dbAvgResponseMs": 45
}
```

### 4. 최근 접속 유저 (`GET /api/admin/users/recent?limit=6`)
```json
[
  {
    "uid": "uuid-123",
    "nickname": "Player1",
    "runCount": 15,
    "lastLoginAt": "2026-05-01T12:00:00Z",
    "isOnline": true
  }
]
```

### 5. 운영 노트 (`GET /api/admin/ops-notes`)
```json
[
  {
    "id": 1,
    "priority": "info",
    "content": "시스템 점검 예정"
  }
]
```
- `priority`: `"info"` | `"warn"` | `"success"`
