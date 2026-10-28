# 로그 수집 API 부하 테스트

`POST /api/v1/logs`가 동시 요청을 어디까지 버티는지 재고, 병목을 고친 뒤 다시 잽니다.
로그 형식은 [클라이언트 로그 명세 v0.6](../docs/chronos-client-log-spec-v0.6.html)을 따릅니다.

| 파일 | 내용 |
|---|---|
| `ingest.js` | k6 스크립트. 가상 유저 1명 = 클라이언트 1대가 v0.6 이벤트 20건씩 묶어 보냄 |
| `../docker-compose.loadtest.yml` | 테스트용 오버라이드. 전용 DB 볼륨, CPU·메모리 제한, 실험용 서버 설정 |

명령은 전부 PowerShell에서 **저장소 루트**(`docker-compose.yml`이 있는 곳) 기준입니다.

## 준비

**k6 설치** (처음 한 번)

```powershell
winget install k6 --source winget
```

설치 후 PowerShell을 새로 열고 확인합니다.

```powershell
k6 version
```

**이미지 빌드** (코드를 바꿨을 때마다)

```powershell
docker compose build
```

## 테스트 스택 켜고 끄기

**켜기** — 실제 로그 볼륨(`chronos-pgdata`) 대신 테스트 볼륨(`chronos-pgdata-loadtest`)을 붙입니다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.loadtest.yml up -d
```

**테스트 데이터 비우기** — 측정마다 빈 DB에서 시작합니다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.loadtest.yml down
```

```powershell
docker volume rm chronos-pgdata-loadtest
```

**평소 스택으로 돌아가기**

```powershell
docker compose up -d
```

⚠️ `down -v`는 쓰지 않습니다. 평소 스택에서 쓰면 실제 로그 볼륨이 지워집니다.

## 0단계 — 더미 적재 확인

테스트 볼륨에 더미 로그(v0.6, 1만여 건)를 넣고 어드민 화면에서 눈으로 확인합니다.

```powershell
$env:LOADTEST_PROFILE = "local"
```

```powershell
docker compose -f docker-compose.yml -f docker-compose.loadtest.yml up -d
```

http://localhost:8081 에서 확인합니다.

- 대시보드와 통계에 숫자가 나오는지
- 유저 검색 → 유저 상세에서 사망 원인(피격·장판·OC 소진), 재화 잔량이 보이는지
- 2층 스테이지(2-1 ~ 2-B)가 통계에 나오는지

확인이 끝나면 프로필을 끄고 테스트 데이터를 비웁니다.

```powershell
Remove-Item Env:LOADTEST_PROFILE
```

그다음 위의 "테스트 데이터 비우기"를 실행합니다.

## 1단계 — 지금 코드 그대로 (기준선)

지금 `LogService`는 배치 안의 이벤트를 한 건씩 INSERT하고 트랜잭션이 없습니다.
요청 하나에 DB 왕복 20번, 커넥션 대여·반납 20번이 일어납니다.

**1. 빈 테스트 스택을 켭니다.** (`LOADTEST_PROFILE`이 꺼진 상태인지 확인)

**2. 서버 로그를 다른 창에 띄워 둡니다.** 30초마다 커넥션 풀 상태가 찍힙니다.

```powershell
docker logs -f chronos-server
```

`Pool stats (total=10, active=10, idle=0, waiting=37)`처럼 `waiting`이 쌓이면 풀이 모자란 것입니다.

**3. 컨테이너 CPU·메모리를 또 다른 창에 띄워 둡니다.**

```powershell
docker stats
```

**4. 부하를 겁니다.** 기본값은 가상 유저 50 → 100 → 200 → 400명으로 1분씩 올립니다.

```powershell
k6 run loadtest/ingest.js
```

**5. 결과를 아래 표에 적습니다.** k6 요약에서 볼 값:

| k6 항목 | 뜻 |
|---|---|
| `http_reqs` 의 `/s` | 초당 요청 수. × 20 하면 초당 저장한 로그 수 |
| `http_req_duration` 의 `p(95)` | 요청 95%가 이 시간 안에 끝남 |
| `http_req_failed` | 실패율 |

## 2단계 — 병목을 고치고 같은 조건으로 다시

1단계에서 본 병목을 고칩니다. 예: 배치를 `batchUpdate` 한 번으로 넣고 트랜잭션으로 묶기.
이미지를 다시 빌드하고, 테스트 데이터를 비운 뒤, 1단계와 **같은 명령**으로 다시 잽니다.

## 3단계 — 설정 맞추기, 운영 서버 사양으로 재기

커넥션 풀과 톰캣 스레드를 바꿔 가며 잽니다. 값을 바꾼 뒤 테스트 스택을 다시 `up -d` 해야 적용됩니다.

```powershell
$env:HIKARI_POOL_SIZE = "20"
```

```powershell
$env:TOMCAT_MAX_THREADS = "50"
```

운영 서버(Oracle Cloud, ARM)와 같은 CPU·메모리로 제한해서 잽니다. 값은 실제 인스턴스 사양으로 넣습니다.

```powershell
$env:SERVER_CPUS = "1"; $env:SERVER_MEMORY = "1g"; $env:DB_CPUS = "1"; $env:DB_MEMORY = "1g"
```

로컬 PC(x86)는 CPU 1개의 성능이 ARM 서버와 다릅니다. 로컬 결과는 **같은 PC 안에서 전후 비교**로만 쓰고,
"운영 서버가 몇 TPS를 버티나"는 운영 서버에 대고 다른 PC에서 k6를 돌려서 잽니다.

```powershell
$env:BASE_URL = "http://<서버 IP>:8080"
```

## 실험 손잡이

| 환경변수 | 기본값 | 대상 |
|---|---|---|
| `STAGES` | `50:1m,100:1m,200:1m,400:1m,0:20s` | k6. 가상 유저 수와 시간 |
| `BATCH` | `20` | k6. 요청 하나에 담는 이벤트 수 |
| `SLEEP` | `0` | k6. 요청 사이 쉬는 초. `15`면 실제 클라 한 대와 같은 속도 |
| `BASE_URL` | `http://localhost:8080` | k6. 요청 보낼 서버 |
| `HIKARI_POOL_SIZE` | `10` | 서버. 커넥션 풀 크기 |
| `TOMCAT_MAX_THREADS` | `200` | 서버. 요청 처리 스레드 수 |
| `HIKARI_LOG_LEVEL` | `DEBUG` | 서버. 풀 상태 로그 |
| `LOADTEST_PROFILE` | (없음) | 서버. `local`이면 부팅 때 더미 적재 |
| `SERVER_CPUS` / `SERVER_MEMORY` | `2` / `2g` | 서버 컨테이너 제한 |
| `DB_CPUS` / `DB_MEMORY` | `2` / `2g` | DB 컨테이너 제한 |

`$env:` 값은 그 PowerShell 창을 닫을 때까지 유지됩니다. 지울 때는 `Remove-Item Env:이름`.

## 결과

| 날짜 | 단계 | 변경 내용 | 제한 (서버 / DB) | 풀 / 스레드 | 최대 VU | 요청/s | p95 | 실패율 | 메모 |
|---|---|---|---|---|---|---|---|---|---|
| | 1 | 기준선 | 2 CPU 2g / 2 CPU 2g | 10 / 200 | | | | | |
