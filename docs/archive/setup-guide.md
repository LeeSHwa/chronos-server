# Chronos 로그 서버 설치 가이드

**대상:** 처음 이 서버를 자기 PC에서 돌리는 사람
**소요 시간:** 20~40분 (재부팅 1회 포함)
**필요한 것:** Windows 10/11, 여유 디스크 10GB 이상

---

## 0. 무엇을 설치하는가

```
[게임(Unity)] ──HTTP:8080──▶ [Spring Boot 컨테이너] ──▶ [PostgreSQL 컨테이너]
                                    └─── Docker Desktop 안에서 실행 ───┘
```

**한 PC 안에서 전부 돕니다. 인터넷 연결이 없어도 동작합니다.**

설치할 것은 **Docker Desktop 하나뿐**입니다.
Java, PostgreSQL, IntelliJ 같은 건 설치하지 않습니다 — 전부 컨테이너 안에 들어 있습니다.

---

## 1. Docker Desktop 설치

### 1-1. 다운로드

https://www.docker.com/products/docker-desktop/ → **Download for Windows (AMD64)**

### 1-2. 설치

설치 중 아래 선택지가 나오면:

| 선택지 | 고를 것 |
|---|---|
| Installation type | **Per-user installation (Recommended)** |
| Use WSL 2 instead of Hyper-V | **체크** (기본값) |

> **Per-user installation**은 관리자 권한 없이 현재 사용자 계정에만 설치합니다.
> 회사·학교 PC처럼 권한이 제한된 환경에서도 설치됩니다.

### 1-3. 재부팅

설치가 끝나면 **재부팅하라고 안내**가 나옵니다. 반드시 재부팅하세요.
(WSL2라는 Windows 기능을 켜야 하는데, 이건 재시작해야 적용됩니다.)

### 1-4. 실행 확인

재부팅 후 Docker Desktop을 실행하고, 창 왼쪽 아래가 **`Engine running`** (초록색)이 될 때까지 기다립니다.
처음 실행은 1~2분 걸릴 수 있습니다.

---

## 2. (선택) Ubuntu 설치 — 안 해도 됩니다

**Docker Desktop이 자체 WSL 환경을 만들기 때문에 Ubuntu 배포판은 필수가 아닙니다.**
아래 명령어는 전부 **PowerShell**에서 실행 가능합니다.

리눅스 셸이 익숙해서 쓰고 싶다면:

```powershell
wsl --install -d Ubuntu-24.04
```

설치 후 Docker Desktop → **Settings → Resources → WSL Integration** 에서
`Ubuntu-24.04` 토글을 켜야 우분투 안에서 `docker` 명령이 동작합니다.

---

## 3. 파일 받기

담당자에게 아래 3개를 받습니다.

| 파일 | 설명 | 크기 |
|---|---|---|
| `chronos-images.tar` | 서버·DB 이미지 | 약 500MB~1GB |
| `docker-compose.yml` | 실행 설정 | 1KB |
| 게임 빌드 폴더 | Unity 빌드 | — |

**같은 폴더에 두세요.** 예: `C:\chronos\`

---

## 4. 서버 실행

PowerShell을 열고 파일이 있는 폴더로 이동합니다.

```powershell
cd C:\chronos
```

### 4-1. 이미지 불러오기 (최초 1회, 1~3분)

```powershell
docker load -i chronos-images.tar
```

`Loaded image: ...` 가 두 줄 나오면 성공입니다.

### 4-2. 실행

```powershell
docker compose up -d
```

### 4-3. 확인

```powershell
docker compose ps
```

두 줄 모두 **`running`** 이면 정상입니다.

```
NAME                       STATUS
chronos-postgres-1         Up
chronos-server-1           Up
```

브라우저에서 **http://localhost:8080/swagger-ui.html** 을 열어 API 문서가 뜨면 서버가 살아 있는 것입니다.

---

## 5. 게임 실행 후 로그 확인

1. 게임 빌드(`.exe`)를 실행합니다
2. **로비에서 게임을 정상적으로 시작**합니다 (아래 주의사항 참고)
3. **15초 이상** 기다립니다 (로그는 15초마다 묶어서 전송됩니다)
4. 아래 명령으로 확인:

```powershell
docker compose exec postgres psql -U postgres -d chronos -c "SELECT event_type, count(*) FROM game_events GROUP BY event_type ORDER BY 2 DESC;"
```

이런 결과가 나오면 성공입니다:

```
 event_type  | count
-------------+-------
 FLOOR_ENTER |     7
 RUN_START   |     1
 PLAYER_DEATH|     1
 RUN_END     |     1
```

### ⚠️ 로그가 안 쌓일 때 먼저 확인할 것

| 증상 | 원인 | 해결 |
|---|---|---|
| 아무것도 안 옴 | **Unity 에디터로 실행함** | 반드시 **빌드된 exe**로 실행 |
| 아무것도 안 옴 | 로비를 거치지 않고 스테이지 직접 실행 | **로비에서 정상적으로 게임 시작** |
| 방금 플레이했는데 없음 | 15초 배치 주기 | 조금 더 기다리기 |

> 게임은 서버가 꺼져 있어도 정상 동작합니다. 로그는 큐에 쌓였다가 나중에 재전송됩니다.
> 즉 **로그가 안 보인다고 게임이 잘못된 것은 아닙니다.**

---

## 6. 일상적인 조작

| 하고 싶은 것 | 명령 |
|---|---|
| 서버 시작 | `docker compose up -d` |
| 서버 정지 | `docker compose stop` |
| 상태 확인 | `docker compose ps` |
| 서버 로그 보기 | `docker compose logs -f server` |
| 완전 삭제 (**데이터 포함**) | `docker compose down -v` ⚠️ |

**PC를 재부팅해도 자동으로 다시 뜹니다** (`restart: unless-stopped` 설정).

`docker compose down -v` 는 **수집한 데이터까지 전부 지웁니다.** 함부로 쓰지 마세요.

---

## 7. 데이터 백업

수집한 로그를 파일로 내보냅니다.

```powershell
docker compose exec -T postgres pg_dump -U postgres chronos > backup.sql
```

복원:

```powershell
Get-Content backup.sql | docker compose exec -T postgres psql -U postgres -d chronos
```

> **데이터를 넘겨줄 때는 이 `backup.sql` 파일을 전달하면 됩니다.**

---

## 8. 자주 겪는 문제

**`docker: command not found` / 연결 실패**
→ Docker Desktop이 실행 중이 아닙니다. 실행하고 `Engine running` 확인.

**`port is already allocated`**
→ 8080 또는 5432 포트를 다른 프로그램이 쓰고 있습니다.
```powershell
netstat -ano | findstr :8080
```
로 확인 후 그 프로그램을 종료하거나, `docker-compose.yml`의 포트를 바꾸세요.

**컨테이너가 계속 재시작됨**
```powershell
docker compose logs server
```
로 원인을 확인하세요. 대부분 DB가 아직 준비 안 된 상태라 잠시 후 자동으로 정상화됩니다.

**설치 중 "WSL 2 installation is incomplete"**
→ 재부팅을 안 했을 가능성이 높습니다. 재부팅 후 다시 실행하세요.
