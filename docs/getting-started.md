# Chronos 서버 실행 가이드

Docker 이미지만으로 게임 로그 서버 + DB + 어드민 대시보드를 띄운다.
소스 코드나 빌드 도구는 필요 없다.

| 구성 | 이미지 | 포트 |
|---|---|---|
| 로그 수집 + 어드민 API | `lshwa/chronos-server:1.1` | 8080 |
| 어드민 대시보드 | `lshwa/chronos-web:1.0` | 8081 |
| DB | `postgres:16` | 5432 |

세 이미지 모두 공개되어 있어 `docker compose up -d` 하면 자동으로 받아진다.

---

## 0. 시작 전 — 기존 데이터 초기화

처음 실행하는 경우 이 단계는 건너뛴다.

컨테이너를 지워도 DB 볼륨은 남는다. 깨끗한 상태로 시작하려면 볼륨까지 지워야 한다.

```bash
docker compose down
```

```bash
docker volume rm chronos-pgdata
```

볼륨이 없으면 `no such volume` 이 뜨는데 무시하면 된다.

---

## 1. 준비물

- **Docker Desktop** — https://www.docker.com/products/docker-desktop 에서 설치 후 실행
- 우측 하단(또는 트레이)에 **Engine running** 표시가 떠 있어야 한다

---

## 2. 파일 준비

`docker-compose.yml` 파일을 받아서 아무 폴더에나 둔다. 이 파일 하나면 된다.

이후 모든 명령은 **그 파일이 있는 폴더에서** 실행한다.

---

## 3. 실행

```bash
docker compose up -d
```

처음 실행하면 이미지를 받느라 몇 분 걸린다(약 1.3GB). 두 번째부터는 몇 초다.

---

## 4. 확인

**컨테이너 상태**

```bash
docker compose ps
```

3개가 모두 `Up` 이어야 한다. `chronos-postgres` 는 `(healthy)` 까지 붙는다.

**대시보드**

브라우저에서 http://localhost:8081

**API**

```bash
curl http://localhost:8080/api/admin/server/status
```

`{"status":"HEALTHY", ...}` 가 나오면 정상이다.

### ⚠️ 수치가 전부 0으로 보이는 것이 정상이다

대시보드 숫자는 게임 클라이언트가 보낸 로그로 채워진다.
게임을 돌리지 않으면 DB가 비어 있으므로 모든 값이 0이다.

**화면이 뜨고 우측 상단에 초록불 "서버 정상"이 보이면 정상 동작하는 것이다.**

---

## 5. 끄기 / 다시 켜기

**끄기** (데이터는 유지된다)

```bash
docker compose down
```

**다시 켜기**

```bash
docker compose up -d
```

**로그 보기** (문제가 생겼을 때)

```bash
docker compose logs -f server
```

---

## 6. 게임 연결

게임 클라이언트의 `LogManager.ServerUrl` 을 아래로 설정한다.

```
http://localhost:8080/api/v1/logs
```

게임과 서버가 다른 PC면 `localhost` 대신 서버 PC의 IP를 넣는다.

> 유니티 에디터에서 플레이하면 로그가 전송되지 않는다. **반드시 빌드해서 실행할 것.**

---

## 7. DB 직접 보기

**접속**

```bash
docker compose exec postgres psql -U postgres -d chronos
```

**쌓인 로그 개수와 마지막 수신 시각**

```sql
SELECT count(*) AS events, count(DISTINCT run_id) AS plays, max(server_time) AS last FROM game_events;
```

**실시간 감시** (psql 안에서, 2초마다 자동 갱신)

```sql
SELECT id, event_type, floor, round, client_time FROM game_events ORDER BY id DESC LIMIT 15;
\watch 2
```

---

## 8. 데이터 백업 / 초기화

**백업**

```bash
docker compose exec -T postgres pg_dump -U postgres chronos > backup.sql
```

**전체 삭제** (되돌릴 수 없음)

```bash
docker compose exec postgres psql -U postgres -d chronos -c "TRUNCATE game_events RESTART IDENTITY;"
```

> 게임을 켜둔 채로 삭제하면, 게임이 큐에 들고 있던 로그가 나중에 들어온다.
> 완전히 비우려면 **게임을 먼저 종료**하고 삭제할 것.

---

## 9. 인터넷 없는 곳에서 실행

전시장처럼 인터넷이 없는 환경에서는 이미지를 미리 파일로 옮긴다.

**인터넷 되는 PC에서 저장**

```bash
docker save lshwa/chronos-server:1.1 lshwa/chronos-web:1.0 postgres:16 -o chronos-images.tar
```

**대상 PC에서 불러오기**

```bash
docker load -i chronos-images.tar
```

이후 `docker compose up -d` 하면 이미지가 이미 로컬에 있으므로 네트워크를 타지 않는다.

---

## 문제 해결

**`port is already allocated`**

8080 / 8081 / 5432 중 하나를 다른 프로그램이 쓰고 있다. 해당 프로그램을 끄거나, `docker-compose.yml` 에서 포트 왼쪽 숫자를 바꾼다.

> 단 8080을 바꾸면 대시보드가 API를 못 찾는다. 8080은 비워두는 편이 낫다.

**`pull access denied` / `repository does not exist`**

이미지 이름이나 태그가 틀렸다. `docker-compose.yml` 의 `image:` 줄을 확인한다.
공개 이미지라 로그인은 필요 없다.

**대시보드는 뜨는데 숫자가 전부 `—` 로 표시됨**

서버가 DB에 붙지 못한 상태다.

```bash
docker compose logs server
```

**컨테이너는 떴는데 페이지가 안 열림**

Docker Desktop이 실행 중인지, `docker compose ps` 에서 3개가 모두 `Up` 인지 확인한다.
