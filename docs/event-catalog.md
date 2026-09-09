# Chronos 이벤트 카탈로그

**용도:** 어떤 이벤트에 어떤 payload를 실을지에 대한 설계 문서
**대상:** 클라이언트 구현 (검증용 브랜치)
**작성:** 2026-08-09

> 전시(8/15) 최소 요구사항은 [client-log-spec.md](client-log-spec.md)에 있습니다.
> 이 문서는 그보다 넓은 범위 — **"결국 어디까지 수집할 것인가"** 의 설계도입니다.

---

## 0. 설계 원칙 (읽기 전에)

**① 이벤트 종류를 늘리기보다 payload를 두껍게 한다**

총알 한 발마다 이벤트를 만들면 분당 수백 건이 되어 부피가 터집니다.
대신 클라가 **라운드 동안 카운터를 세다가, 이정표 이벤트에 한 번에 실어보냅니다.**

```
❌  SHOT_FIRED × 412건
✅  ROUND_CLEAR payload: { "shotsFired": 412, ... }
```

이벤트 수는 그대로, 정보량은 증가, 서버는 JSONB라 수정 불필요.

**② 런은 정확히 하나의 `RUN_END`로 닫힌다**

사망·클리어·포기·타임아웃 **모두** `RUN_END`로 종결하고, `payload.result`로 구분합니다.
새 이벤트(`RUN_CLEAR`, `RUN_QUIT` …)를 만들지 않습니다.
→ 런 개수 집계가 `COUNT(RUN_END)` 하나로 끝납니다.

**③ 유추 가능한 것은 만들지 않는다**

`FLOOR_ENTER`가 스테이지 전환마다 발생하므로 "1-3 진입 = 1-2 클리어"가 성립합니다.
다만 **클리어 시점의 상태값**(잔여 타이머, 카운터)이 필요하면 별도 이벤트가 필요합니다 → `ROUND_CLEAR`.

**④ 이름·단위 규칙**

- 키는 **camelCase**
- 시간은 **초 단위**, 이름에 `Sec` 명시 (`ms`를 쓸 거면 `Ms`)
- 열거값은 **대문자 스네이크** (`WIN`, `DEATH`)
- 값이 없으면 **키를 생략** (`null` 넣지 않음)

---

## 1. 공통 필드 (엔벨로프)

모든 이벤트에 자동으로 붙는 값. `ClientLogEnvelope`가 담당합니다.

| 필드 | 타입 | 상태 | 설명 |
|---|---|---|---|
| `userId` | long | ✅ 기존 | 설치 단위 식별자 (사람 아님) |
| `eventType` | string | ✅ 기존 | 아래 카탈로그 |
| `timestamp` | string | ✅ 기존 | ISO-8601 (`ToString("o")`) |
| `difficulty` | string | ✅ 기존 | `Standard`/`Endless`/`Limited`/`Timeless` |
| `runId` | long? | ✅ 기존 | = `SeedManager.MasterSeed` |
| `floor` | int? | ✅ 기존 | |
| `round` | int? | ✅ 기존 | 물리/논리 혼재 (3장 참고) |
| **`timeRemainingSec`** | **int?** | 🟠 **추가 권장** | **잔여 오버클럭(초).** 타이머가 HP 역할이므로 최우선 |
| `clientVersion` | string? | ⚪ 추가 | 현재 `ACCOUNT_LOGIN` payload에만 존재 |
| `env` | string? | ⚪ 추가 | `expo`/`local`. 서버에서 채워도 됨 |

> **`timeRemainingSec`을 엔벨로프에 넣는 이유:** 거의 모든 이벤트에서 의미가 있고,
> payload마다 중복으로 넣느니 공통으로 한 번 넣는 게 싸고 일관됩니다.
> 접근자: `StageRuntimeManager.Instance.CurrentOverclockSeconds` (float, 초)
> ⚠️ 내부 저장은 **데시초**(`overclockDeciseconds`)이므로 `/10` 변환 필요.

---

## 2. 이벤트 카탈로그

범례 — ✅ 기존 구현 / 🟠 전시 전 권장 / 🟡 전시 후 / ⚪ 선택

---

### ✅ `ACCOUNT_LOGIN`
앱 기동 시 1회 (메인메뉴 `Awake`)

| payload | 타입 | 상태 | 비고 |
|---|---|---|---|
| `platform` | string | ✅ | |
| `clientVersion` | string | ✅ | |
| `region` | string | ✅ | 현재 `"KR"` 하드코딩 |
| `isFirstLaunch` | bool | ⚪ | 세이브가 새로 생성됐는지 (userId 최초 발급) |

`runId`/`floor`/`round` 없음.

---

### ✅ `RUN_START`
`StartNewRun` — 로비 출구 포탈 통과, 시드 발급 직후

| payload | 타입 | 상태 | 비고 |
|---|---|---|---|
| `characterClass` | string | ✅ | 현재 `"WARRIOR"` 하드코딩 |
| `startTimeSec` | int | 🟠 | **시작 오버클럭 총량.** 난이도별로 다르면 필수 |
| `totalRuns` | int | ⚪ | 이 기기의 누적 런 수 (세이브값) |
| `seed` | long | ⚪ | `runId`와 동일하지만 명시적으로 남기고 싶다면 |

---

### ✅ `RUN_RESUME`
메인메뉴 Continue 클릭

| payload | 타입 | 상태 | 비고 |
|---|---|---|---|
| `resumedFloor` | int | ⚪ | 엔벨로프 `floor`와 중복이라 생략 가능 |
| `awaySec` | int | 🟡 | 마지막 저장 이후 경과 시간 |

> ⚠️ **전시 빌드에서는 Continue 자체를 비활성화**하는 것이 권장됩니다.
> 관람객 A가 중단한 런을 관람객 B가 이어받으면 같은 `runId`에 두 사람이 섞입니다.

---

### ✅ `FLOOR_ENTER`
① `RUN_START` 직후 ② 포탈 커밋 시 (= 스테이지 전환마다)

| payload | 타입 | 상태 | 비고 |
|---|---|---|---|
| `stageType` | string | 🟠 | `NORMAL`/`BOSS`/`SHOP`/`REST` 등. **라운드 성격 구분에 필요** |
| `physicalRound` | int | 🟡 | 셔플된 물리 번호 (논리와 분리해 기록) |
| `logicalRound` | int | 🟡 | 진행 순번 |

> ⚠️ 현재 `round` 컬럼에 **물리/논리가 섞여** 들어옵니다.
> 둘 다 payload에 명시적으로 넣으면 혼선이 사라집니다.

---

### 🟠 `ROUND_CLEAR` — **신규, 가장 가치 높음**
라운드(스테이지) 하나를 클리어하고 다음 포탈이 열릴 때

**이 이벤트가 "두꺼운 payload" 전략의 핵심입니다.**
클라가 라운드 동안 카운터를 세다가 여기서 한 번에 비웁니다.

| payload | 타입 | 비고 |
|---|---|---|
| `elapsedSec` | int | 이 라운드 소요 시간 |
| `timeGainedSec` | int | 클리어 보상으로 얻은 오버클럭 |
| `timeLostSec` | int | 이 라운드에서 잃은 오버클럭 (피격 등) |
| `killCount` | int | 이 라운드 처치 수 |
| `damageTakenCount` | int | 피격 횟수 |
| `stageType` | string | `NORMAL`/`BOSS`/`SHOP` |

접근자: `CurrentRoundMonsterKillCount`, `CurrentRoundPlannedMonsterCount` 등

> **왜 필요한가:** 현재 `FLOOR_CLEAR`는 **보스 처치 시에만** 발생해서
> 일반 라운드의 클리어 시점 상태가 전혀 기록되지 않습니다.
> 진입(`FLOOR_ENTER`)만 있고 클리어가 없어 **"어느 라운드가 오래 걸리는가"** 를 알 수 없습니다.

---

### ✅ `FLOOR_CLEAR`
보스 HP 0 → 층 클리어

| payload | 타입 | 상태 | 비고 |
|---|---|---|---|
| `clearTimeMs` | long | ✅ | |
| `deathsInFloor` | int | ✅ | **항상 0** (로그라이크라 사망 시 런 종료). 제거 검토 |
| `killCountInFloor` | int | 🟡 | 이 층 누적 처치 수 |
| `timeRemainingSec` | int | 🟠 | 엔벨로프로 올리면 불필요 |

---

### ✅ `BOSS_KILL`
보스 HP 0 (`FLOOR_CLEAR`와 같은 함수에서 연속 발생)

| payload | 타입 | 상태 | 비고 |
|---|---|---|---|
| `bossId` | string | ✅ | 현재 `"F{floor}_B"` 조립. **실제 보스 식별자로 교체 권장** |
| `clearTimeMs` | long | ✅ | |
| `fightDurationSec` | int | 🟡 | 보스전 자체 소요 시간 |
| `augments` | array | 🟡 | 클리어 시점 증강 구성 (아래 `AUGMENT_SELECTED` 참고) |

---

### ✅ `PLAYER_DEATH`
`CompleteRunByDeath`

| payload | 타입 | 상태 | 비고 |
|---|---|---|---|
| `survivalTimeMs` | long | ✅ | |
| `killerId` | string | ✅ | **항상 null** — 추적 코드 없음 |
| `deathCause` | string | 🟠 | `TIMEOUT`/`MONSTER`/`BOSS`/`HAZARD` ← **값 정의 필요** |
| `killerId` | string | 🟠 | 실제 채우기. 마지막 피해원 |
| `killCount` | int | 🟠 | 이 런의 총 처치 수 |
| `augments` | array | 🟡 | 사망 시점 증강 구성 |
| `inventory` | object | 🟡 | 사망 시점 장비 (스냅샷) |

> **타이머 = HP** 구조라면 모든 사망이 사실상 타이머 소진입니다.
> 그렇다면 `deathCause`는 "무엇이 타이머를 깎았나"를 의미하도록 정의해야 합니다.
> **이 값의 의미를 먼저 확정할 것.**

---

### ✅ `RUN_END`
런 종결 — **사망/클리어/포기/타임아웃 모두 이 이벤트로**

| payload | 타입 | 상태 | 비고 |
|---|---|---|---|
| `result` | string | ✅ | **아래 표로 확장** |
| `totalTimeMs` | long | ✅ | |
| `reachedFloor` | int | ⚪ | 엔벨로프 `floor`와 중복 |
| `killCount` | int | 🟠 | 런 총 처치 수 |
| `roundsCleared` | int | 🟠 | 클리어한 라운드 총 개수 |
| `augments` | array | 🟡 | 최종 증강 구성 |
| `inventory` | object | 🟡 | 최종 장비 |

**`result` 값 (확장안)**

| 값 | 의미 | 상태 |
|---|---|---|
| `WIN` | 최종 보스 클리어 | ✅ 기존 |
| `DEATH` | 사망 | ✅ 기존 `LOSE` → 개명 |
| `QUIT` | 메뉴에서 포기/로비 복귀 | 🟠 **신규** |
| `TIMEOUT` | 타이머 소진 (사망과 구분한다면) | ⚪ |

> `LOSE` → `DEATH` 개명은 전시 전 DB를 비울 예정이므로 기존 데이터 호환을 신경 쓰지 않아도 됩니다.
> **`QUIT`이 실질적으로 가장 중요합니다** — 전시장에서는 포기가 가장 흔한 종료 사유입니다.

---

### 🟠 `HEARTBEAT` — 신규
30초 주기 (플레이 중에만)

| payload | 타입 | 비고 |
|---|---|---|
| (없음) | | 엔벨로프의 `floor`/`round`/`timeRemainingSec`만으로 충분 |

> **관람객이 게임을 끝내지 않고 자리를 뜨면 `RUN_END`가 오지 않습니다.**
> 마지막 heartbeat 시각으로 이탈 시점을 복원할 수 있습니다.
> 코루틴 하나로 구현 가능. **전시장에서 매우 유용합니다.**

---

### 🟡 `AUGMENT_SELECTED` — 신규
증강 선택 UI에서 하나를 고른 순간

| payload | 타입 | 비고 |
|---|---|---|
| `augmentId` | int | 선택한 증강 |
| `stacks` | int | 선택 후 스택 수 |
| `offered` | int[] | **제시된 선택지 전체** ← 이게 핵심 |
| `rerolled` | bool | 리롤 사용 여부 (기능 있다면) |

> **`offered`가 있어야 "선택률"을 계산할 수 있습니다.**
> "A증강이 100번 제시돼서 80번 선택됨(80%)" vs "10번 제시돼서 8번 선택됨" 은
> 완전히 다른 정보인데, 선택된 것만 기록하면 구분이 불가능합니다.
>
> **로그라이크 밸런싱 데이터 중 가장 가치가 높습니다.** 캡스톤 발표에서도 그림이 좋습니다.

---

### 🟡 `ITEM_ACQUIRED` — 신규
아이템/무기/룬 획득

| payload | 타입 | 비고 |
|---|---|---|
| `templateId` | int | |
| `rank` | int | `ItemRank` 0(None)~4(S) |
| `seasonType` | int | 0(None), 1(Spring)~4(Winter) |
| `source` | string | `MONSTER_DROP`/`SHOP`/`REWARD`/`CHEST` |
| `slot` | string | `BAG`/`WEAPON`/`RUNE` |

> 라운드별 인벤토리 스냅샷의 **차이(diff)로도 "무엇을 얻었는지"는 유추 가능**합니다.
> 다만 **획득 출처(`source`)와 순서**는 이 이벤트가 있어야만 알 수 있습니다.

---

### 🟡 `ITEM_EQUIPPED` — 신규
장착 변경

| payload | 타입 | 비고 |
|---|---|---|
| `templateId` | int | |
| `slot` | string | |
| `replacedTemplateId` | int? | 교체된 기존 아이템 |

> **대안:** `ROUND_CLEAR` payload에 장착 상태 전체를 넣으면 이 이벤트 없이도
> "라운드별 빌드 변화"를 추적할 수 있습니다. 그쪽이 클라 작업량이 적습니다.

---

### ⚪ `SHOP_PURCHASE` — 신규
상점 구매 (상점 스테이지가 있다면)

| payload | 타입 |
|---|---|
| `templateId` | int |
| `cost` | int |
| `currencyAfter` | int |

---

### ✅ `CLIENT_ERROR` — **호출부 연결 필요**
현재 정의만 있고 호출하는 코드가 없습니다.

| payload | 타입 | 상태 |
|---|---|---|
| `errorCode` | string | ✅ |
| `clientVersion` | string | ✅ |
| `message` | string | 🟠 |
| `stackTrace` | string | ⚪ 길이 제한 필요 |

> `Application.logMessageReceived` 에 핸들러를 붙여 예외를 자동 수집하면
> **전시 중 발생한 크래시를 원격으로 파악**할 수 있습니다.
> 운영 관점에서 값어치가 큽니다.

---

### 🟡 `RUN_SNAPSHOT` — 신규 (전시 후)
세이브 시점(라운드 클리어)에 `RuntimeSession` 전체를 payload로

| payload | 타입 |
|---|---|
| (RuntimeSession 직렬화 결과 전체) | object |

> **`RunSessionRecorder`가 이미 캡처하고 있는 그 객체를 그대로 실으면 됩니다.**
> `JsonUtility.ToJson(session)` 결과를 payload로 넘기면 끝이라 클라 작업이 거의 없습니다.
>
> 크기: 판당 약 2KB × 라운드 8회 × 런 500회 ≈ **8MB**. 무시 가능한 수준입니다.
>
> **이게 있으면 "나중에 생각난 질문"에도 답할 수 있습니다.**
> 개별 이벤트는 지금 정한 것만 남지만, 스냅샷은 그 시점의 상태 전체를 남깁니다.
> 슬레이 더 스파이어식 런 히스토리 기능도 이 데이터로 만들 수 있습니다.

---

## 3. 우선순위 정리

### 🔴 전시(8/15) 전 필수
| # | 항목 | 작업량 |
|---|---|---|
| 1 | `ServerUrl` 설정 | 1줄 |
| 2 | 전시 빌드에서 Continue 비활성화 | 버튼 1개 |

### 🟠 전시 전 권장 (여유가 되면, 이 순서로)
| # | 항목 | 이유 |
|---|---|---|
| 3 | `timeRemainingSec` 엔벨로프 추가 | 타이머가 HP인데 어디에도 기록 안 됨 |
| 4 | `RUN_END.result`에 `QUIT` 추가 | 전시장 최다 종료 사유 |
| 5 | `HEARTBEAT` | 이탈 시점 복원 |
| 6 | `ROUND_CLEAR` + 카운터 | 라운드별 분석의 기반 |
| 7 | `PLAYER_DEATH`에 `deathCause`/`killCount` | 사망 분석 |

### 🟡 전시 후
`AUGMENT_SELECTED` → `RUN_SNAPSHOT` → `ITEM_ACQUIRED` → `CLIENT_ERROR` 연결

---

## 4. 서버 측 영향

**대부분 없습니다.**

- payload는 **JSONB**라 필드를 추가해도 서버 수정 불필요
- 새 `eventType`이 와도 그대로 저장됨 (enum 검증 없음)
- **엔벨로프 공통 필드를 추가할 때만** 서버에 컬럼 추가가 필요합니다
  → `timeRemainingSec`, `clientVersion` 을 넣기로 하면 알려주세요 (`ALTER TABLE ADD COLUMN`, 기존 데이터 보존됨)

---

## 5. 확인 필요 사항

- [ ] `PLAYER_DEATH.deathCause` 값 정의 — 타이머 소진 외의 사망이 존재하는가?
- [ ] 라운드 타입 종류 — `NORMAL`/`BOSS`/`SHOP`/`REST` 중 실제로 있는 것은?
- [ ] 증강 리롤 기능 존재 여부
- [ ] 상점 스테이지 존재 여부
- [ ] `runElapsedSeconds` / `totalPlayTimeMs` 가 실제로 채워지는지 (현재 세이브에선 0)
- [ ] 게임에 시드 직접 입력 기능이 있는가 (있으면 `runId` 충돌 가능)
