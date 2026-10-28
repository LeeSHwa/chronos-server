# Chronos 로그 서버

로그라이크 게임 **Chronos**의 플레이 로그를 수집하는 서버와 어드민 대시보드입니다.

```
[게임(Unity)] ──POST /api/v1/logs──┐
                                  ├──▶ [Spring Boot :8080] ──▶ [PostgreSQL :5432]
[어드민 웹 :8081] ──GET /api/admin/*─┘
```

## 구성

| 폴더 | 내용 | 포트 |
|---|---|---|
| `server/` | 로그 수집 + 어드민 API (Spring Boot, Java 21, JdbcTemplate) | 8080 |
| `admin-web/` | 어드민 대시보드 (Vanilla JS, 빌드 도구 없음) | 8081 |
| `docker-compose.yml` | DB · 서버 · 웹을 한 번에 띄우는 설정 | 5432 (DB, 로컬에서만) |
| `docs/` | 로그 명세와 가이드 | |

## 실행

Docker만 있으면 됩니다. 이미지는 실행하는 머신에서 직접 빌드하므로 JDK나 Gradle은 필요 없습니다.

**1. `.env` 만들기**

```bash
cp .env.example .env
```

`.env`를 열어 `POSTGRES_PASSWORD`를 채웁니다.

**2. 빌드하고 실행**

```bash
docker compose build
```

```bash
docker compose up -d
```

**3. 확인**

브라우저에서 http://localhost:8081 을 엽니다.

**끄기**

```bash
docker compose down
```

DB 데이터는 `chronos-pgdata` 볼륨에 남습니다. 백업, 초기화, 오프라인 실행은 [getting-started.md](docs/getting-started.md)를 보세요.

## 로그 보내기

- 엔드포인트: `POST http://<서버>:8080/api/v1/logs`
- 형식: [클라이언트 로그 명세 v0.6](docs/chronos-client-log-spec-v0.6.html)
- 요청 예시: [server/test.http](server/test.http)

## 더미 데이터

서버를 `local` 프로파일로 실행하면 부팅할 때 30일치 더미 로그(v0.6 형식)를 DB에 넣습니다.
실제 로그와 섞이므로 운영 DB에서는 켜지 마세요. docker compose로 띄울 때는 켜지지 않습니다.

## 문서

| 문서 | 내용 |
|---|---|
| [chronos-client-log-spec-v0.6.html](docs/chronos-client-log-spec-v0.6.html) | 클라이언트 로그 명세. 이벤트와 payload의 기준 |
| [getting-started.md](docs/getting-started.md) | 실행, 백업, 오프라인 실행, 문제 해결 |
| [architecture.md](docs/architecture.md) | 컨테이너 · 포트 · 비밀번호 전달 구조 |
| [archive/](docs/archive/) | 지난 명세와 전시(2026-08) 기록 |

## 남은 과제

- **인증 없음.** 누구나 대시보드를 보고 로그를 보낼 수 있습니다.
- **스키마 마이그레이션 도구 없음.** `schema.sql`이 `CREATE TABLE IF NOT EXISTS`라 기존 테이블에 컬럼을 추가해도 반영되지 않습니다.
- **어드민 API 명세 v2 필요.** [archive/admin-spec.md](docs/archive/admin-spec.md)는 5월 H2 시절 v1입니다.
