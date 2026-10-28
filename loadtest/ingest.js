// 로그 수집 API(POST /api/v1/logs) 부하 테스트.
//
// 가상 유저(VU) 하나 = 게임 클라이언트 한 대.
// 클라가 실제로 보내는 모양 그대로, v0.6 형식 이벤트를 배열로 묶어 보낸다.
// 각 VU는 자기 판을 진행하면서(RUN_START → 스테이지들 → RUN_END) 다음 이벤트를 만든다.
//
// 실행 예 (PowerShell, 저장소 루트에서):
//   k6 run loadtest/ingest.js
//   $env:STAGES = "20:30s,20:1m"; k6 run loadtest/ingest.js
//
// 환경변수
//   BASE_URL  기본 http://localhost:8080
//   STAGES    "VU수:시간" 목록. 기본 "50:1m,100:1m,200:1m,400:1m,0:20s" (점점 올려서 어디서 무너지는지 본다)
//   BATCH     한 요청에 담는 이벤트 수. 기본 20 (클라 배치 상한)
//   SLEEP     요청 사이 쉬는 초. 기본 0 = 최대 압력. 15로 두면 실제 클라 한 대와 같은 속도

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const BATCH = parseInt(__ENV.BATCH || '20', 10);
const SLEEP = parseFloat(__ENV.SLEEP || '0');

export const options = {
  stages: (__ENV.STAGES || '50:1m,100:1m,200:1m,400:1m,0:20s').split(',').map((s) => {
    const [target, duration] = s.split(':');
    return { target: parseInt(target, 10), duration };
  }),
  // 넘으면 결과에 ✗ 로 표시만 하고 테스트는 끝까지 돈다. 무너지는 지점을 보는 게 목적이다.
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

// ─────────────────────────────────────────────
// 64비트 id
//
// JS 숫자는 2^53까지만 정확하다. 2208189609186332156 같은 값을 숫자로 다루면 끝자리가 뭉개지므로
// 10진수 문자열로 만들고, 요청 본문을 만들 때 따옴표만 벗긴다(toBody).
// 19자리, 첫 자리 1~8이면 항상 long 범위(9223372036854775807) 안이다.
// ─────────────────────────────────────────────

function randomLongString() {
  let s = String(1 + Math.floor(Math.random() * 8));
  for (let i = 0; i < 18; i++) s += Math.floor(Math.random() * 10);
  return (Math.random() < 0.5 ? '-' : '') + s;
}

function toBody(events) {
  return JSON.stringify(events).replace(/"(userId|runId)":"(-?\d+)"/g, '"$1":$2');
}

// ─────────────────────────────────────────────
// 판 진행 — 명세 v0.6 4장의 흐름을 그대로 따른다
// ─────────────────────────────────────────────

const FIELD_COUNT = [4, 3];
const DIFFICULTIES = ['Standard', 'Endless', 'Limited', 'Timeless'];
const ATTACK_TYPES = ['SPECIAL_SHOT', 'PRECISION_TARGETING', 'CONVERSION'];
const MAPS = [['F1_1', 'F1_2', 'F1_3', 'F1_4', 'F1_B'], ['F2_1', 'F2_2', 'F2_3', 'F2_B']];
const ENEMIES = [['2001', '2002', '2003', '2010'], ['3001', '3010']];
const BOSSES = ['2100', '3002'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (n) => Math.floor(Math.random() * n);

// VU마다 따로 도는 상태. k6는 VU마다 이 파일을 따로 실행하므로 전역 변수가 곧 VU 상태다.
const userId = randomLongString();
let run = null;    // 진행 중인 판
let queue = [];    // 다음에 보낼 이벤트

function newRun() {
  return {
    runId: randomLongString(),
    difficulty: pick(DIFFICULTIES),
    attackType: pick(ATTACK_TYPES),
    floor: 0,
    stage: 0,
    elapsedMs: 0,
    oc: 600,
    basic: 0,
    timeStop: 0,
  };
}

function round(r) {
  return r.stage === FIELD_COUNT[r.floor] ? 'B' : String(r.stage + 1);
}

function envelope(eventType, payload, withStage = true) {
  const e = {
    userId,
    eventType,
    timestamp: new Date().toISOString(),
    difficulty: run.difficulty,
    runId: run.runId,
    payload,
  };
  if (withStage) {
    e.floor = run.floor + 1;
    e.round = round(run);
  }
  return e;
}

// 실제 로그와 비슷한 크기의 build (장비 4, 룬 3, 증강 2~3)
function build() {
  return {
    weapons: [0, 1, 2, 3].map((slot) => ({ slot, templateId: 11001 + rand(6), rank: pick(['C', 'B', 'A', 'S']) })),
    runes: [0, 1, 2].map((slot) => ({ slot, templateId: 21001, season: pick(['SPRING', 'SUMMER', 'AUTUMN', 'WINTER']), fusionStack: 1 + rand(3) })),
    augments: [{ augmentId: 8, stacks: 1 }, { augmentId: 5 + rand(10), stacks: 1 + rand(2) }],
  };
}

function currency() {
  return { basic: run.basic, timeStop: run.timeStop };
}

function roundEnter() {
  return envelope('ROUND_ENTER', {
    mapId: MAPS[run.floor][run.stage],
    elapsedMs: run.elapsedMs,
    overclockDeciseconds: run.oc,
    currency: currency(),
  });
}

/** 판 하나에서 다음 묶음을 큐에 채운다. 사망·클리어로 판이 끝나면 새 판을 연다. */
function advance() {
  if (!run) {
    run = newRun();
    queue.push(envelope('RUN_START', { attackType: run.attackType, clientVersion: '1.0' }, false));
    queue.push(envelope('FLOOR_ENTER', { fieldCount: FIELD_COUNT[run.floor], hasBoss: true }));
    queue.push(roundEnter());
    return;
  }

  const boss = run.stage === FIELD_COUNT[run.floor];
  run.elapsedMs += 30000 + rand(60000);

  if (Math.random() < (boss ? 0.3 : 0.08)) {
    const cause = pick(['MONSTER', 'MONSTER', 'HAZARD', 'DRAIN']);
    const death = { deathCause: cause };
    if (cause === 'MONSTER') death.killerId = boss ? BOSSES[run.floor] : pick(ENEMIES[run.floor]);
    if (cause === 'HAZARD') death.killerId = 'RESIDUAL_BEAM';
    death.elapsedMs = run.elapsedMs;
    death.build = build();
    queue.push(envelope('PLAYER_DEATH', death));
    queue.push(envelope('RUN_END', { result: 'DEATH', elapsedMs: run.elapsedMs, overclockDeciseconds: 0, build: build() }));
    run = null;
    return;
  }

  run.oc = 200 + rand(3000);
  run.basic += 3 + rand(6);
  run.timeStop += 1 + rand(5);
  queue.push(envelope('ROUND_CLEAR', {
    clearElapsedMs: run.elapsedMs,
    clearOverclockDeciseconds: run.oc,
    clearCurrency: currency(),
    build: build(),
  }));

  if (boss && run.floor === FIELD_COUNT.length - 1) {
    queue.push(envelope('RUN_END', { result: 'WIN', elapsedMs: run.elapsedMs, overclockDeciseconds: run.oc, build: build() }));
    run = null;
    return;
  }

  // 상점에서 일부를 쓴다
  run.basic -= rand(run.basic + 1);
  run.timeStop -= rand(run.timeStop + 1);

  run.stage++;
  if (run.stage > FIELD_COUNT[run.floor]) {
    run.floor++;
    run.stage = 0;
    queue.push(envelope('FLOOR_ENTER', { fieldCount: FIELD_COUNT[run.floor], hasBoss: true }));
  }
  queue.push(roundEnter());
}

function nextBatch() {
  while (queue.length < BATCH) advance();
  return queue.splice(0, BATCH);
}

// ─────────────────────────────────────────────

export default function () {
  const res = http.post(`${BASE_URL}/api/v1/logs`, toBody(nextBatch()), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'status 200': (r) => r.status === 200 });
  if (SLEEP > 0) sleep(SLEEP);
}
