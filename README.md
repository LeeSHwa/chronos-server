# Chronos

로그라이크 게임 **Chronos** 의 로그 수집 서버와 운영 대시보드.

게임 클라이언트(Unity)가 플레이 이벤트를 서버로 보내고, 서버는 PostgreSQL에 적재한다.
어드민 대시보드에서 그 데이터를 조회한다.

```
[게임(Unity)] ──POST /api/v1/logs──┐
                                  ├──▶ [Spring Boot :8080] ──▶ [PostgreSQL :5432]
[어드민 웹 :8081] ──GET /api/admin/*─┘
```

---

## 구조

```
.
├─ docker-compose.yml     전체 스택 (DB + 서버 + 웹)
├─ server/                Spring Boot (Java 21, JdbcTemplate)
├─ admin-web/             어드민 대시보드 (Vanilla JS + Tailwind, 빌드 도구 없음)
└─ docs/                  명세 및 가이드
```

| 포트 | 용도 |
|---|---|
| 8080 | 로그 수집 + 어드민 API |
| 8081 | 어드민 대시보드 |
| 5432 | PostgreSQL |

---

## 실행

```bash
cp .env.example .env
```

`POSTGRES_PASSWORD` 를 채운 뒤:

```bash
docker compose build && docker compose up -d
```

브라우저에서 http://localhost:8081

> 이미지는 Hub에서 받지 않고 **직접 빌드한다.** amd64 PC에서 만든 이미지는
> ARM 서버에서 동작하지 않기 때문에, 빌드하는 머신에 맞춰 생성되게 했다.
> JDK 나 Gradle 은 설치할 필요 없다 — 빌드가 컨테이너 안에서 일어난다.

자세한 절차와 문제 해결은 [docs/getting-started.md](docs/getting-started.md) 참고.

> `server` 이미지는 DB 비밀번호를 담고 있지 않다.
> `docker-compose.yml` 이 `SPRING_DATASOURCE_PASSWORD` 로 주입한다.
> IDE에서 직접 실행할 때는 실행 구성에 환경변수로 넣어야 한다.

---

## 문서

| 문서 | 내용 |
|---|---|
| [client-log-spec.md](docs/client-log-spec.md) | **클라이언트가 보내는 로그 명세 (SoT)**. 서버 스키마와 지표는 전부 여기서 파생된다 |
| [event-catalog.md](docs/event-catalog.md) | 이벤트별 payload 설계 |
| [getting-started.md](docs/getting-started.md) | 이미지만으로 스택 띄우는 절차 |
| [setup-guide.md](docs/setup-guide.md) | 처음부터 환경 구성하기 |
| [expo-checklist.md](docs/expo-checklist.md) | 2026-08-15 부산 전시 준비 기록 |
| [admin-spec.md](docs/admin-spec.md) | ⚠️ 어드민 API 명세 **v1 (2026-05)**. 현재 구현과 어긋남 — 아래 참고 |

---

## 알려진 과제

**어드민 API 명세가 낡았다.** `admin-spec.md` 는 H2 시절 기준이라 현재 구현과 다르다.
실제로는 `round` 가 String, `timestamp` 가 `clientTime`/`serverTime` 으로 분리됐고,
`difficulty` 와 수집 하트비트(`lastEventAt`)가 추가됐다. v2 작성이 필요하다.

**스키마 마이그레이션 도구가 없다.** `schema.sql` 이 `CREATE TABLE IF NOT EXISTS` 라
기존 테이블에 컬럼을 추가해도 반영되지 않는다. 새 테이블 추가는 문제없다.
운영 데이터가 쌓이기 시작하면 Flyway 도입이 필요하다.

**층별 클리어율을 현재 데이터로 계산할 수 없다.** 클라이언트가 스테이지 단위
`FLOOR_CLEAR` 를 보내지 않고, `round` 값에 물리/논리 두 체계가 섞여 있다.
진입 이벤트 순번으로 진행도를 계산하는 방식으로 대체해야 한다.
자세한 내용은 [client-log-spec.md](docs/client-log-spec.md) 3장 참고.
