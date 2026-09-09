# 전시 준비 체크리스트 (8/15 부산)

**작성:** 2026-08-09 (D-6)

---

## ✅ 이미 끝난 것

- [x] Docker + PostgreSQL 16 컨테이너 (볼륨 영속화)
- [x] Spring Boot → PostgreSQL 전환 (`application.yml`, 드라이버, `sql.init.mode`)
- [x] 스키마 확정 (`game_events`, payload JSONB)
- [x] DTO/도메인을 클라 엔벨로프 포맷에 맞춤
- [x] 리포지토리 INSERT (`?::jsonb`)
- [x] `test.http` 로 적재 검증
- [x] **실제 게임 → 서버 → DB 적재 확인**
- [x] 클라 `ServerUrl` 설정
- [x] 문서: 클라 명세 / 이벤트 카탈로그 / 설치 가이드

---

## 🔴 반드시 해야 하는 것

### 1. Git 저장소 (오늘)
현재 버전 관리가 전혀 없음. 실수로 파일을 잃으면 복구 불가.

- [ ] `.gitignore` 작성 (`build/`, `out/`, `.gradle/`, `*.tar`)
- [ ] `git init` → 첫 커밋
- [ ] GitHub 저장소 연결 및 push

### 2. 도커 패키징 (~8/11)
- [ ] `./gradlew bootBuildImage --imageName=chronos-server`
- [ ] `docker-compose.yml` 작성
- [ ] 본인 PC에서 `docker compose up -d` 로 전체 스택 검증
- [ ] `docker save postgres:16 chronos-server -o chronos-images.tar`
- [ ] **다른 PC에서 tar + compose 만으로 동작하는지 확인** ← 이게 진짜 검증

> ⚠️ 8/12까지 도커 방식이 안정화 안 되면 **미련 없이 롤백**할 것.
> 기존 방식(로컬 Java + Docker Postgres)도 이미 검증됐음. 전시 3일 전에 도박하지 말 것.

### 3. 백업 절차 (~8/13)
전시 데이터를 잃으면 모든 게 무의미해짐. **가장 중요한 항목.**

- [ ] 백업 명령 확인
  ```
  docker compose exec -T postgres pg_dump -U postgres chronos > backup_YYYYMMDD_HHMM.sql
  ```
- [ ] 복원까지 실제로 한 번 테스트해볼 것 (백업만 하고 복원을 안 해본 백업은 백업이 아님)
- [ ] USB 준비

### 4. 리허설 (8/10~8/12)
- [ ] 부스와 동일한 환경에서 **30분 이상 연속 플레이**
- [ ] PC 재부팅 후 컨테이너가 자동으로 뜨는지
- [ ] 게임을 여러 판 연속으로 돌려서 `run_id`가 판마다 바뀌는지 확인
  ```sql
  SELECT run_id, count(*), min(client_time), max(client_time)
  FROM game_events GROUP BY run_id ORDER BY 3;
  ```
- [ ] 서버를 일부러 껐다 켜보고, 그동안의 로그가 재전송되는지 확인

---

## 🟠 팀장 확인 필요

- [ ] **전시 빌드에서 Continue(이어하기) 비활성화**
      → 관람객 A가 중단한 런을 B가 이어받으면 같은 `runId`에 두 사람이 섞임.
      `runId`가 플레이어 수를 세는 유일한 기준이라 집계가 무의미해짐.
- [ ] `ACCOUNT_LOGIN` 이 실제로 전송되는지
      → `ShouldTransmit`의 `MasterSeed == 0` 가드에 걸릴 가능성이 높음
      (메인메뉴 시점엔 아직 런이 시작되지 않아 시드가 0)
- [ ] 부스 **게임 PC 대수** (1대 / 여러 대)
      → 여러 대면 `ServerUrl`을 IP로 바꿔야 하고 방화벽·공유기가 필요함
- [ ] 게임에 **시드 직접 입력 기능**이 있는지 (있으면 `runId` 충돌 가능)

---

## 🟡 여유가 되면 (우선순위 순)

- [ ] `RUN_END.result` 에 `QUIT` 추가 — 전시장 최다 종료 사유인데 현재 구분 불가
- [ ] `timeRemainingSec`(오버클럭 잔량)을 엔벨로프에 추가
      → 타이머가 HP 역할인데 **어디에도 기록되지 않음**. 서버는 `ALTER TABLE ADD COLUMN` 한 줄
- [ ] `HEARTBEAT` 30초 주기 — 중도 이탈 시점 복원
- [ ] `JdbcAdminDashboardRepository` SQL 수정 (`client_time`, `payload->>`, `round` String)
- [ ] 부스용 간단 카운터 페이지 ("지금까지 N명이 플레이했습니다")

---

## 📅 전시 당일 (8/15)

### 시작 전
- [ ] `docker compose up -d` → `docker compose ps` 로 둘 다 `Up` 확인
- [ ] **테스트 데이터 삭제**
  ```sql
  TRUNCATE game_events RESTART IDENTITY;
  ```
- [ ] 게임 한 판 돌려서 로그가 들어오는지 최종 확인
- [ ] 확인 후 다시 `TRUNCATE`

### 진행 중
- [ ] **점심때 백업 1회**
- [ ] 가끔 확인
  ```sql
  SELECT count(DISTINCT run_id) AS plays, count(*) AS events FROM game_events;
  ```

### 종료 후
- [ ] **백업 (`pg_dump`) → USB 복사 → 클라우드에도 업로드**
- [ ] 백업 파일이 실제로 열리는지 확인하고 철수

---

## 전시 후

1. 데이터 분석 + 대시보드 (`run_id` 기준으로 새로 설계 — 기존 DAU 지표는 부스 PC 1대라 무의미)
2. `AUGMENT_SELECTED` 등 이벤트 확장 ([event-catalog.md](event-catalog.md))
3. `RUN_SNAPSHOT` — 런 히스토리 기능
4. 인덱스 추가 + `EXPLAIN ANALYZE` 로 before/after 측정 (포트폴리오 소재)
5. JPA 이행 검토
