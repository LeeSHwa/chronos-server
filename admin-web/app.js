/**
 * Chronos Admin — app.js  v2
 * 명세: admin-spec.md v1 (2026-05-17)
 *
 * USE_MOCK = true  → 백엔드 없이 mock 데이터로 동작
 * USE_MOCK = false → 실제 API 호출 (백엔드 구현 후 전환)
 */

const BASE_URL  = 'http://localhost:8080';
const USE_MOCK  = false;

// ─────────────────────────────────────────────
// MOCK 데이터 (명세 4장 응답 예시 기반)
// ─────────────────────────────────────────────

const MOCK_OVERVIEW = {
  dauToday: 350,
  runsStartedToday: 47,
  runsClearedToday: 8,
  dauSeries: [
    { date: '2026-05-04', dau: 312 }, { date: '2026-05-05', dau: 298 },
    { date: '2026-05-06', dau: 341 }, { date: '2026-05-07', dau: 278 },
    { date: '2026-05-08', dau: 305 }, { date: '2026-05-09', dau: 289 },
    { date: '2026-05-10', dau: 322 }, { date: '2026-05-11', dau: 367 },
    { date: '2026-05-12', dau: 301 }, { date: '2026-05-13', dau: 318 },
    { date: '2026-05-14', dau: 334 }, { date: '2026-05-15', dau: 309 },
    { date: '2026-05-16', dau: 327 }, { date: '2026-05-17', dau: 350 },
  ],
  recentUsers: [
    { userId: 25,  lastSeenAt: '2026-05-17T10:02:00', runCount: 4,  isOnline: true  },
    { userId: 42,  lastSeenAt: '2026-05-17T09:58:00', runCount: 12, isOnline: true  },
    { userId: 7,   lastSeenAt: '2026-05-17T09:45:00', runCount: 1,  isOnline: false },
    { userId: 103, lastSeenAt: '2026-05-17T09:30:00', runCount: 8,  isOnline: false },
    { userId: 56,  lastSeenAt: '2026-05-17T08:11:00', runCount: 3,  isOnline: false },
    { userId: 88,  lastSeenAt: '2026-05-17T07:55:00', runCount: 20, isOnline: false },
    { userId: 13,  lastSeenAt: '2026-05-16T22:11:00', runCount: 3,  isOnline: false },
    { userId: 31,  lastSeenAt: '2026-05-16T21:30:00', runCount: 6,  isOnline: false },
    { userId: 64,  lastSeenAt: '2026-05-16T18:45:00', runCount: 15, isOnline: false },
    { userId: 19,  lastSeenAt: '2026-05-16T15:22:00', runCount: 2,  isOnline: false },
  ],
};

const MOCK_FLOORS = {
  totalRuns: 120,
  floors: [
    { floor: 1, round: 1, label: '1-1', entered: 120, cleared: 118, clearRate: 0.9833, avgClearMs: 42000,  avgDeaths: 0.1 },
    { floor: 1, round: 2, label: '1-2', entered: 118, cleared: 95,  clearRate: 0.8051, avgClearMs: 65000,  avgDeaths: 0.4 },
    { floor: 1, round: 3, label: '1-3', entered: 95,  cleared: 78,  clearRate: 0.8211, avgClearMs: 71000,  avgDeaths: 0.6 },
    { floor: 2, round: 1, label: '2-1', entered: 78,  cleared: 65,  clearRate: 0.8333, avgClearMs: 88000,  avgDeaths: 0.8 },
    { floor: 2, round: 2, label: '2-2', entered: 65,  cleared: 48,  clearRate: 0.7385, avgClearMs: 102000, avgDeaths: 1.2 },
    { floor: 2, round: 3, label: '2-3', entered: 48,  cleared: 32,  clearRate: 0.6667, avgClearMs: 125000, avgDeaths: 1.8 },
    { floor: 3, round: 1, label: '3-1', entered: 32,  cleared: 20,  clearRate: 0.6250, avgClearMs: 145000, avgDeaths: 2.1 },
    { floor: 3, round: 2, label: '3-2', entered: 20,  cleared: 12,  clearRate: 0.6000, avgClearMs: 178000, avgDeaths: 2.5 },
    { floor: 3, round: 3, label: '3-3', entered: 12,  cleared: 8,   clearRate: 0.6667, avgClearMs: 245000, avgDeaths: 3.2 },
  ],
};

const MOCK_USER_DETAIL = {
  userId: 25,
  totalRuns: 12,
  maxFloorReached: { floor: 3, round: 2, label: '3-2' },
  lastSeenAt: '2026-05-17T10:02:00',
  avgRunTimeMs: 845000,
  winRate: 0.0833,
};

const MOCK_USER_EVENTS = {
  events: [
    { id: 91823, eventType: 'FLOOR_CLEAR',    timestamp: '2026-05-17T10:01:30', runId: 1842937561, floor: 2, round: 3, payload: { clearTimeMs: 78400, deathsInFloor: 0 } },
    { id: 91822, eventType: 'FLOOR_ENTER',    timestamp: '2026-05-17T09:59:00', runId: 1842937561, floor: 2, round: 3, payload: { floor: 2, round: 3 } },
    { id: 91820, eventType: 'FLOOR_CLEAR',    timestamp: '2026-05-17T09:58:30', runId: 1842937561, floor: 2, round: 2, payload: { clearTimeMs: 102000, deathsInFloor: 1 } },
    { id: 91818, eventType: 'PLAYER_DEATH',   timestamp: '2026-05-17T09:55:00', runId: 1842937561, floor: 2, round: 2, payload: { survivalTimeMs: 45000, killerId: null } },
    { id: 91817, eventType: 'FLOOR_ENTER',    timestamp: '2026-05-17T09:53:20', runId: 1842937561, floor: 2, round: 2, payload: { floor: 2, round: 2 } },
    { id: 91815, eventType: 'FLOOR_CLEAR',    timestamp: '2026-05-17T09:51:00', runId: 1842937561, floor: 2, round: 1, payload: { clearTimeMs: 88000, deathsInFloor: 0 } },
    { id: 91814, eventType: 'FLOOR_ENTER',    timestamp: '2026-05-17T09:49:30', runId: 1842937561, floor: 2, round: 1, payload: { floor: 2, round: 1 } },
    { id: 91812, eventType: 'FLOOR_CLEAR',    timestamp: '2026-05-17T09:48:00', runId: 1842937561, floor: 1, round: 3, payload: { clearTimeMs: 71000, deathsInFloor: 0 } },
    { id: 91810, eventType: 'FLOOR_ENTER',    timestamp: '2026-05-17T09:46:50', runId: 1842937561, floor: 1, round: 3, payload: { floor: 1, round: 3 } },
    { id: 91808, eventType: 'FLOOR_CLEAR',    timestamp: '2026-05-17T09:45:40', runId: 1842937561, floor: 1, round: 2, payload: { clearTimeMs: 65000, deathsInFloor: 0 } },
    { id: 91806, eventType: 'FLOOR_ENTER',    timestamp: '2026-05-17T09:44:30', runId: 1842937561, floor: 1, round: 2, payload: { floor: 1, round: 2 } },
    { id: 91804, eventType: 'FLOOR_CLEAR',    timestamp: '2026-05-17T09:43:20', runId: 1842937561, floor: 1, round: 1, payload: { clearTimeMs: 42000, deathsInFloor: 0 } },
    { id: 91802, eventType: 'FLOOR_ENTER',    timestamp: '2026-05-17T09:42:00', runId: 1842937561, floor: 1, round: 1, payload: { floor: 1, round: 1 } },
    { id: 91800, eventType: 'RUN_START',      timestamp: '2026-05-17T09:41:00', runId: 1842937561, floor: null, round: null, payload: { characterClass: 'WARRIOR' } },
    { id: 91799, eventType: 'ACCOUNT_LOGIN',  timestamp: '2026-05-17T09:40:30', runId: null, floor: null, round: null, payload: { platform: 'PC', clientVersion: '1.0.2', region: 'KR' } },
    { id: 91750, eventType: 'RUN_END',        timestamp: '2026-05-16T21:55:00', runId: 1842912345, floor: null, round: null, payload: { reachedFloor: 3, reachedRound: 2, totalTimeMs: 1245000, result: 'WIN' } },
    { id: 91749, eventType: 'BOSS_KILL',      timestamp: '2026-05-16T21:50:00', runId: 1842912345, floor: 3, round: 3, payload: { bossId: 'Boss_Chronos_Slayer', clearTimeMs: 245000 } },
    { id: 91748, eventType: 'CLIENT_ERROR',   timestamp: '2026-05-16T21:30:00', runId: 1842912345, floor: 3, round: 1, payload: { errorCode: 'ERR_SYNC_TIMEOUT', clientVersion: '1.0.2' } },
    { id: 91700, eventType: 'RUN_RESUME',     timestamp: '2026-05-16T20:10:00', runId: 1842898765, floor: null, round: null, payload: { resumedFloor: 2, resumedRound: 1 } },
  ],
  nextCursor: null,
};

const MOCK_SERVER_STATUS = {
  status: 'HEALTHY',
  version: 'v1.0.0',
  lastSyncAt: '2026-05-17T10:03:09',
};

// ─────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────

function fmt(n) {
  return Number(n).toLocaleString('ko-KR');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 서버 시각 문자열 → epoch ms.
 *
 * 백엔드는 타임존이 없는 로컬 ISO('2026-08-12T20:33:00')를 보낸다. JS는 이 형태를
 * 이미 '로컬 시각'으로 파싱하므로 그대로 넘기면 된다.
 * 예전처럼 'Z'를 덧붙이면 UTC로 해석돼 KST 기준 9시간 어긋났고, 그 결과 미래 시각이
 * 돼서 모든 이벤트가 '방금 전'으로 표시됐다.
 * 나중에 서버가 오프셋 포함 형태('...+09:00')로 바꿔도 Date가 그대로 처리한다.
 */
function parseServerTime(isoString) {
  if (isoString == null) return NaN;
  return new Date(String(isoString).replace(/(\.\d{3})\d*/, '$1')).getTime();
}

/** ISO 8601 → 상대 시간 */
function relativeTime(isoString) {
  const t = parseServerTime(isoString);
  if (Number.isNaN(t)) return '—';
  const diff = Math.floor((Date.now() - t) / 1000);
  if (diff < 60)    return '방금 전';
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

/** ms → "Xm Ys" (백엔드가 아직 못 채우는 집계값은 null로 온다) */
function fmtMs(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return '—';
  const s = Math.floor(Number(ms) / 1000);
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

/** 소수 1자리 (null 허용) — null.toFixed() 크래시 방지용 */
function fmtFixed1(v) {
  return (v == null || Number.isNaN(Number(v))) ? '—' : Number(v).toFixed(1);
}

/** 0~1 비율 → "12.3%" (null 허용) */
function fmtPct(ratio) {
  return (ratio == null || Number.isNaN(Number(ratio))) ? '—' : (Number(ratio) * 100).toFixed(1) + '%';
}

/** ISO → 날짜+시각 짧게 */
function fmtDatetime(isoString) {
  const t = parseServerTime(isoString);
  if (Number.isNaN(t)) return '—';
  return new Date(t).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function removeSkeleton(el) { el?.classList.remove('skeleton'); }

function showError(id, msg = '오류') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('skeleton');
  el.classList.add('text-rose-500');
}

// ─────────────────────────────────────────────
// API fetch (USE_MOCK 플래그로 분기)
// ─────────────────────────────────────────────

async function fetchJSON(path) {
  // Content-Type 헤더를 붙이면 GET이 'simple request'에서 벗어나 매 호출마다
  // CORS preflight(OPTIONS)가 한 번씩 더 나간다. 본문 없는 GET엔 의미도 없어서 뺐다.
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`${res.status} — ${path}`);
  return res.json();
}

async function apiOverview()          { return USE_MOCK ? structuredClone(MOCK_OVERVIEW)      : fetchJSON('/api/admin/stats/overview'); }
async function apiFloors(from, to)    { return USE_MOCK ? structuredClone(MOCK_FLOORS)        : fetchJSON(`/api/admin/stats/floors?from=${from}&to=${to}`); }
async function apiServerStatus()      { return USE_MOCK ? structuredClone(MOCK_SERVER_STATUS) : fetchJSON('/api/admin/server/status'); }
async function apiUserSearch(q)       {
  if (USE_MOCK) {
    const match = MOCK_OVERVIEW.recentUsers.filter(u => String(u.userId).startsWith(String(q)));
    return { results: match.map(u => ({ userId: u.userId, runCount: u.runCount, lastSeenAt: u.lastSeenAt })) };
  }
  return fetchJSON(`/api/admin/users/search?q=${encodeURIComponent(q)}`);
}
async function apiUserDetail(userId)  {
  if (USE_MOCK) return structuredClone({ ...MOCK_USER_DETAIL, userId: Number(userId) });
  return fetchJSON(`/api/admin/users/${userId}`);
}
async function apiUserEvents(userId, cursor) {
  if (USE_MOCK) return structuredClone(MOCK_USER_EVENTS);
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=50` : '?limit=50';
  return fetchJSON(`/api/admin/users/${userId}/events${q}`);
}

// ─────────────────────────────────────────────
// 차트 인스턴스 관리
// ─────────────────────────────────────────────

let dauChartInstance   = null;
let floorsChartInstance = null;

function destroyChart(instance) {
  if (instance) { instance.destroy(); }
}

/** Chart.js 다크 테마 기본값 적용 */
function applyChartDefaults() {
  const isLight = document.documentElement.classList.contains('light');
  Chart.defaults.color       = isLight ? '#64748b' : '#4a5068';
  Chart.defaults.borderColor = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
}

// ─────────────────────────────────────────────
// 테마 관리
// ─────────────────────────────────────────────

function updateThemeIcon(isLight) {
  document.getElementById('theme-icon-sun')?.classList.toggle('hidden', isLight);
  document.getElementById('theme-icon-moon')?.classList.toggle('hidden', !isLight);
}

function applyTheme(theme) {
  const isLight = theme === 'light';
  document.documentElement.classList.toggle('light', isLight);
  updateThemeIcon(isLight);
}

function toggleTheme() {
  const isLight = document.documentElement.classList.contains('light');
  const next = isLight ? 'dark' : 'light';
  localStorage.setItem('chronos-theme', next);
  applyTheme(next);
}

function initTheme() {
  const saved   = localStorage.getItem('chronos-theme');
  const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved ?? (sysDark ? 'dark' : 'light'));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('chronos-theme')) applyTheme(e.matches ? 'dark' : 'light');
  });
}

// ─────────────────────────────────────────────
// 네비게이션 (SPA)
// ─────────────────────────────────────────────

const PAGES = ['dashboard', 'user-search', 'user-detail', 'play-stats', 'server-status'];

function navigateTo(pageId, params = {}) {
  // 유저 디테일로 이동하기 직전 현재 페이지를 기억
  if (pageId === 'user-detail') {
    previousPage = _currentActivePage();
  }

  // 페이지 div 전환
  PAGES.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.toggle('hidden', p !== pageId);
  });

  // 사이드바 active 상태 (user-detail은 user-search nav 활성)
  const navTarget = pageId === 'user-detail' ? 'user-search' : pageId;
  document.querySelectorAll('[data-page]').forEach(a => {
    const isActive = a.dataset.page === navTarget;
    a.classList.toggle('active', isActive);
    a.classList.toggle('text-slate-500', !isActive);
  });

  // 페이지별 초기화
  if (pageId === 'dashboard')     loadDashboard();
  if (pageId === 'play-stats')    loadPlayStats();
  if (pageId === 'server-status') loadServerStatusPage();
  if (pageId === 'user-detail' && params.userId != null) loadUserDetail(params.userId);
}

// ─────────────────────────────────────────────
// 공통: 서버 상태 (상단 바)
// ─────────────────────────────────────────────

function renderTopBarStatus(data) {
  const STATUS_MAP = {
    HEALTHY:  { dot: 'bg-emerald-500 animate-pulse', text: '서버 정상',   cls: 'text-slate-400' },
    DEGRADED: { dot: 'bg-amber-400 animate-pulse',   text: '서버 불안정', cls: 'text-amber-400' },
    DOWN:     { dot: 'bg-rose-500',                  text: '서버 다운',   cls: 'text-rose-400'  },
  };
  const s = STATUS_MAP[data.status] ?? STATUS_MAP.DEGRADED;

  const dotEl  = document.getElementById('server-status-dot');
  const textEl = document.getElementById('server-status-text');
  const verEl  = document.getElementById('server-version');
  const syncEl = document.getElementById('last-sync-time');

  if (dotEl)  dotEl.className  = `w-2 h-2 rounded-full ${s.dot}`;
  if (textEl) { textEl.textContent = s.text; textEl.className = `text-xs ${s.cls}`; }
  if (verEl)  { verEl.textContent = data.version; removeSkeleton(verEl); }
  if (syncEl) syncEl.textContent = fmtDatetime(data.lastSyncAt);
}

// ─────────────────────────────────────────────
// PAGE: 대시보드
// ─────────────────────────────────────────────

async function loadDashboard() {
  const dateEl = document.getElementById('dashboard-date');
  if (dateEl) {
    dateEl.textContent = `Chronos 운영 현황 — ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  const [statusRes, overviewRes] = await Promise.allSettled([
    apiServerStatus(),
    apiOverview(),
  ]);

  if (statusRes.status === 'fulfilled') {
    renderTopBarStatus(statusRes.value);
  }

  if (overviewRes.status === 'fulfilled') {
    const data = overviewRes.value;
    renderDashboardKPI(data);
    renderDauChart(data.dauSeries);
    renderRecentUsers(data.recentUsers);
  } else {
    console.error('[overview]', overviewRes.reason);
    ['kpi-dau', 'kpi-runs-started', 'kpi-runs-cleared'].forEach(id => showError(id, '—'));
    const el = document.getElementById('recent-users-list');
    if (el) el.innerHTML = '<p class="px-5 py-4 text-xs text-rose-500">데이터를 불러올 수 없습니다.</p>';
  }
}

function renderDashboardKPI(data) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = fmt(val);
    removeSkeleton(el);
  };
  set('kpi-dau',          data.dauToday);
  set('kpi-runs-started', data.runsStartedToday);
  set('kpi-runs-cleared', data.runsClearedToday);
}

function renderDauChart(series) {
  applyChartDefaults();
  destroyChart(dauChartInstance);

  const canvas = document.getElementById('dau-chart');
  if (!canvas) return;

  const isLight  = document.documentElement.classList.contains('light');
  const accentRgb = isLight ? '109,95,245' : '124,110,245';

  dauChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: series.map(d => d.date.slice(5)), // 'MM-DD'
      datasets: [{
        label: 'DAU',
        data: series.map(d => d.dau),
        borderColor: `rgb(${accentRgb})`,
        backgroundColor: `rgba(${accentRgb}, 0.08)`,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: `rgb(${accentRgb})`,
        fill: true,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `${series[items[0].dataIndex].date} DAU`,
            label: (item) => ` ${fmt(item.raw)}명`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 7 } },
        y: { beginAtZero: false, ticks: { callback: v => fmt(v) } },
      },
    },
  });
}

function renderRecentUsers(users) {
  const container = document.getElementById('recent-users-list');
  if (!container) return;
  if (!users.length) {
    container.innerHTML = '<p class="px-5 py-4 text-xs text-muted">최근 접속 유저 없음</p>';
    return;
  }
  container.innerHTML = users.map(u => {
    const dotCls = u.isOnline ? 'bg-emerald-400' : 'bg-slate-600';
    return `
      <button data-userid="${u.userId}"
              class="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-surface-700 transition-colors user-row-btn">
        <div class="w-7 h-7 rounded-full bg-surface-600 flex items-center justify-center text-[10px] font-semibold text-slate-400 flex-shrink-0">
          #${escHtml(String(u.userId))}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-slate-200">userId ${escHtml(String(u.userId))}</p>
          <p class="text-xs text-muted font-mono">런 ${fmt(u.runCount)}회</p>
        </div>
        <div class="text-right flex-shrink-0 flex items-center gap-2">
          <p class="text-xs text-muted">${relativeTime(u.lastSeenAt)}</p>
          <span class="w-1.5 h-1.5 rounded-full ${dotCls} flex-shrink-0"></span>
        </div>
      </button>`;
  }).join('');

  // 유저 클릭 → 디테일 페이지
  container.querySelectorAll('.user-row-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo('user-detail', { userId: btn.dataset.userid }));
  });
}

// ─────────────────────────────────────────────
// PAGE: 유저 검색 (독립 페이지)
// ─────────────────────────────────────────────

async function handleUserSearch(q) {
  if (!q.trim()) return;

  const resultsEl = document.getElementById('search-results');
  if (resultsEl) resultsEl.innerHTML = '<div class="px-5 py-6 text-sm text-muted text-center">검색 중…</div>';

  try {
    const data = await apiUserSearch(q.trim());
    if (!data.results.length) {
      resultsEl.innerHTML = `<div class="px-5 py-6 text-sm text-muted text-center">userId "${escHtml(q)}"에 해당하는 유저가 없습니다.</div>`;
      return;
    }
    resultsEl.innerHTML = `
      <table class="w-full text-xs">
        <thead><tr class="border-b border-surface-700 text-left">
          <th class="px-5 py-3 font-semibold text-muted uppercase tracking-wide text-[10px]">userId</th>
          <th class="px-4 py-3 font-semibold text-muted uppercase tracking-wide text-[10px] text-right">런 수</th>
          <th class="px-4 py-3 font-semibold text-muted uppercase tracking-wide text-[10px] text-right">마지막 접속</th>
          <th class="px-4 py-3"></th>
        </tr></thead>
        <tbody class="divide-y divide-surface-700">
          ${data.results.map(u => `
            <tr class="hover:bg-surface-700 transition-colors">
              <td class="px-5 py-3 font-mono text-slate-300">${escHtml(String(u.userId))}</td>
              <td class="px-4 py-3 text-right text-slate-400">${fmt(u.runCount)}회</td>
              <td class="px-4 py-3 text-right text-muted">${relativeTime(u.lastSeenAt)}</td>
              <td class="px-4 py-3 text-right">
                <button data-userid="${u.userId}"
                        class="text-accent hover:text-violet-300 font-medium transition-colors search-detail-btn">
                  디테일 →
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    resultsEl.querySelectorAll('.search-detail-btn').forEach(btn => {
      btn.addEventListener('click', () => navigateTo('user-detail', { userId: btn.dataset.userid }));
    });
  } catch (e) {
    console.error('[user-search]', e);
    if (resultsEl) resultsEl.innerHTML = '<div class="px-5 py-6 text-sm text-rose-500 text-center">검색 중 오류가 발생했습니다.</div>';
  }
}

// ─────────────────────────────────────────────
// PAGE: 유저 디테일
// ─────────────────────────────────────────────

let currentUserId   = null;
let currentCursor   = null;
let eventsExhausted = false;
let previousPage    = 'dashboard'; // 유저 디테일 → 뒤로 이동 시 사용

async function loadUserDetail(userId) {
  currentUserId   = userId;
  currentCursor   = null;
  eventsExhausted = false;

  document.getElementById('user-detail-title').textContent = `유저 #${escHtml(String(userId))}`;

  // 요약 카드 스켈레톤 복원
  ['ud-total-runs', 'ud-max-floor', 'ud-last-seen', 'ud-avg-run-time', 'ud-win-rate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('skeleton'); el.classList.remove('text-rose-500'); el.textContent = '——'; }
  });

  // 이벤트 테이블 초기화
  const tbody = document.getElementById('events-table-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-6 text-center text-muted">
    <svg class="w-4 h-4 animate-spin text-accent inline-block mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>이벤트 로딩 중…</td></tr>`;

  const loadMoreWrap = document.getElementById('events-load-more-wrap');
  if (loadMoreWrap) loadMoreWrap.classList.add('hidden');

  const [detailRes, eventsRes] = await Promise.allSettled([
    apiUserDetail(userId),
    apiUserEvents(userId, null),
  ]);

  if (detailRes.status === 'fulfilled') {
    renderUserSummary(detailRes.value);
  } else {
    console.error('[user-detail]', detailRes.reason);
    ['ud-total-runs', 'ud-max-floor', 'ud-last-seen', 'ud-avg-run-time', 'ud-win-rate'].forEach(id => showError(id, '—'));
  }

  if (eventsRes.status === 'fulfilled') {
    const data = eventsRes.value;
    currentCursor   = data.nextCursor;
    eventsExhausted = !data.nextCursor;
    renderEventsTable(data.events, false);
    if (!eventsExhausted && loadMoreWrap) loadMoreWrap.classList.remove('hidden');
  } else {
    console.error('[user-events]', eventsRes.reason);
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-4 text-center text-xs text-rose-500">이벤트를 불러올 수 없습니다.</td></tr>`;
  }
}

function renderUserSummary(data) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val;
    removeSkeleton(el);
  };
  set('ud-total-runs',    fmt(data.totalRuns) + '회');
  set('ud-max-floor',     data.maxFloorReached?.label ?? '—');
  set('ud-last-seen',     relativeTime(data.lastSeenAt));
  set('ud-avg-run-time',  fmtMs(data.avgRunTimeMs));
  set('ud-win-rate',      fmtPct(data.winRate));
}

/** 이벤트 타입별 배지 색상 */
const EVENT_BADGE = {
  ACCOUNT_LOGIN: 'bg-sky-900 text-sky-300',
  RUN_START:     'bg-emerald-900 text-emerald-300',
  RUN_RESUME:    'bg-teal-900 text-teal-300',
  FLOOR_ENTER:   'bg-blue-900 text-blue-300',
  FLOOR_CLEAR:   'bg-green-900 text-green-300',
  PLAYER_DEATH:  'bg-rose-900 text-rose-300',
  BOSS_KILL:     'bg-amber-900 text-amber-300',
  RUN_END:       'bg-violet-900 text-violet-300',
  CLIENT_ERROR:  'bg-red-900 text-red-300',
};

/** payload → 한줄 요약 문자열 */
function summarizePayload(eventType, payload) {
  if (!payload) return '—';
  switch (eventType) {
    case 'ACCOUNT_LOGIN':  return `${payload.platform ?? '?'} · v${payload.clientVersion ?? '?'} · ${payload.region ?? '?'}`;
    case 'RUN_START':      return `캐릭터: ${payload.characterClass ?? '?'}`;
    // resumedFloor/Round는 컬럼(floor/round)으로 승격돼 payload에서 빠졌다. 옛 로그만 값이 있다.
    case 'RUN_RESUME':     return payload.resumedFloor != null
                                  ? `이어하기 ${payload.resumedFloor}-${payload.resumedRound}`
                                  : '이어하기';
    case 'FLOOR_ENTER':    return `진입`;
    case 'FLOOR_CLEAR':    return `${fmtMs(payload.clearTimeMs ?? 0)} · 사망 ${payload.deathsInFloor ?? 0}회`;
    case 'PLAYER_DEATH':   return `생존 ${fmtMs(payload.survivalTimeMs ?? 0)}`;
    case 'BOSS_KILL':      return `${payload.bossId ?? '?'} · ${fmtMs(payload.clearTimeMs ?? 0)}`;
    case 'RUN_END':        return `${payload.result ?? '?'} · 총 ${fmtMs(payload.totalTimeMs ?? 0)}`;
    case 'CLIENT_ERROR':   return `${payload.errorCode ?? '?'}`;
    default:               return JSON.stringify(payload).slice(0, 60);
  }
}

function renderEventsTable(events, append) {
  const tbody = document.getElementById('events-table-body');
  if (!tbody) return;

  if (!append) tbody.innerHTML = '';

  if (!events.length && !append) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-6 text-center text-xs text-muted">이벤트 없음</td></tr>`;
    return;
  }

  const rows = events.map(e => {
    const badgeCls = EVENT_BADGE[e.eventType] ?? 'bg-surface-600 text-slate-400';
    const floorLabel = (e.floor != null && e.round != null) ? `${e.floor}-${e.round}` : '—';
    const summary = summarizePayload(e.eventType, e.payload);
    // 서버 수신 시각을 표시하고, 클라 시각은 툴팁으로 둔다. 둘이 크게 벌어지면 전송이 밀리고 있다는 뜻.
    const shownTime = e.serverTime ?? e.clientTime;
    const timeTitle = e.clientTime ? `클라 시각: ${fmtDatetime(e.clientTime)}` : '클라 시각 없음';
    return `
      <tr class="hover:bg-surface-700/50 transition-colors">
        <td class="px-5 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap" title="${escHtml(timeTitle)}">${escHtml(fmtDatetime(shownTime))}</td>
        <td class="px-4 py-3 whitespace-nowrap">
          <span class="badge ${badgeCls}">${escHtml(e.eventType)}</span>
        </td>
        <td class="px-4 py-3 font-mono text-[11px] text-muted">${e.runId != null ? escHtml(String(e.runId)) : '—'}</td>
        <td class="px-4 py-3 text-center text-slate-400">${escHtml(floorLabel)}</td>
        <td class="px-4 py-3 text-muted max-w-xs truncate">${escHtml(summary)}</td>
      </tr>`;
  }).join('');

  tbody.insertAdjacentHTML('beforeend', rows);
}

async function loadMoreEvents() {
  if (eventsExhausted || !currentUserId) return;
  const btn = document.getElementById('events-load-more');
  if (btn) btn.textContent = '로딩 중…';
  try {
    const data = await apiUserEvents(currentUserId, currentCursor);
    currentCursor   = data.nextCursor;
    eventsExhausted = !data.nextCursor;
    renderEventsTable(data.events, true);
    const wrap = document.getElementById('events-load-more-wrap');
    if (eventsExhausted && wrap) wrap.classList.add('hidden');
    else if (btn) btn.textContent = '더 보기 (50건)';
  } catch (e) {
    console.error('[load-more-events]', e);
    if (btn) btn.textContent = '오류 — 다시 시도';
  }
}

// ─────────────────────────────────────────────
// PAGE: 플레이 통계
// ─────────────────────────────────────────────

let currentPeriod = 'today';

/** Date → 'YYYY-MM-DD'. toISOString()은 UTC라 새벽 시간대에 하루가 밀린다 → 로컬 기준으로 조립. */
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function periodToDates(period) {
  const today = new Date();
  const to    = toLocalDateStr(today);
  const daysAgo = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return toLocalDateStr(d);
  };
  if (period === 'today') return { from: to, to };
  if (period === '7d')    return { from: daysAgo(6),  to };  // 오늘 포함 7일
  return                         { from: daysAgo(29), to };  // 오늘 포함 30일
}

async function loadPlayStats() {
  const { from, to } = periodToDates(currentPeriod);

  // 테이블 로딩
  const tbody = document.getElementById('floors-table-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-6 text-center text-muted">
    <svg class="w-4 h-4 animate-spin text-accent inline-block mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>로딩 중…</td></tr>`;

  try {
    const data = await apiFloors(from, to);
    renderFloorsChart(data);
    renderFloorsTable(data);
  } catch (e) {
    console.error('[floors]', e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-4 text-center text-xs text-rose-500">데이터를 불러올 수 없습니다.</td></tr>`;
  }
}

function renderFloorsChart(data) {
  applyChartDefaults();
  destroyChart(floorsChartInstance);

  const canvas = document.getElementById('floors-chart');
  if (!canvas) return;

  const isLight = document.documentElement.classList.contains('light');
  const totalRuns = data.totalRuns || 1;

  floorsChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.floors.map(f => f.label),
      datasets: [
        {
          label: '클리어율',
          data: data.floors.map(f => +(f.clearRate * 100).toFixed(1)),
          borderColor: 'rgb(124, 110, 245)',
          backgroundColor: 'rgba(124, 110, 245, 0.08)',
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: 'rgb(124, 110, 245)',
          fill: true,
          tension: 0.3,
        },
        {
          label: '도달율',
          data: data.floors.map(f => +((f.entered / totalRuns) * 100).toFixed(1)),
          borderColor: 'rgb(52, 211, 153)',
          backgroundColor: 'rgba(52, 211, 153, 0.05)',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 4,
          pointBackgroundColor: 'rgb(52, 211, 153)',
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterBody(items) {
              const idx   = items[0].dataIndex;
              const floor = data.floors[idx];
              return [
                `평균 클리어: ${fmtMs(floor.avgClearMs)}`,
                `평균 사망: ${fmtFixed1(floor.avgDeaths)}회`,
                `도달 런: ${fmt(floor.entered)} / ${fmt(totalRuns)}`,
              ];
            },
            label(item) {
              return ` ${item.dataset.label}: ${item.raw}%`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 0,
          max: 100,
          ticks: { callback: v => `${v}%` },
        },
      },
    },
  });
}

function renderFloorsTable(data) {
  const tbody = document.getElementById('floors-table-body');
  if (!tbody) return;
  if (!data.floors.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-6 text-center text-xs text-muted">데이터 없음</td></tr>`;
    return;
  }
  tbody.innerHTML = data.floors.map(f => {
    const clearPct = (f.clearRate * 100).toFixed(1);
    const pctCls   = f.clearRate >= 0.8 ? 'text-emerald-400' : f.clearRate >= 0.6 ? 'text-amber-400' : 'text-rose-400';
    return `
      <tr class="hover:bg-surface-700/50 transition-colors">
        <td class="px-5 py-3 font-semibold text-slate-200">${escHtml(f.label)}</td>
        <td class="px-4 py-3 text-right font-mono text-slate-400">${fmt(f.entered)}</td>
        <td class="px-4 py-3 text-right font-mono text-slate-400">${fmt(f.cleared)}</td>
        <td class="px-4 py-3 text-right font-mono font-semibold ${pctCls}">${clearPct}%</td>
        <td class="px-4 py-3 text-right font-mono text-slate-400">${fmtMs(f.avgClearMs)}</td>
        <td class="px-4 py-3 text-right font-mono text-slate-400">${fmtFixed1(f.avgDeaths)}회</td>
      </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────
// PAGE: 서버 상태
// ─────────────────────────────────────────────

async function loadServerStatusPage() {
  try {
    const data = await apiServerStatus();
    renderTopBarStatus(data);

    const STATUS_MAP = {
      HEALTHY:  { dot: 'bg-emerald-500 animate-pulse', label: 'HEALTHY', labelCls: 'text-emerald-400' },
      DEGRADED: { dot: 'bg-amber-400 animate-pulse',   label: 'DEGRADED', labelCls: 'text-amber-400' },
      DOWN:     { dot: 'bg-rose-500',                  label: 'DOWN',    labelCls: 'text-rose-400'  },
    };
    const s = STATUS_MAP[data.status] ?? STATUS_MAP.DEGRADED;

    const dot   = document.getElementById('ss-dot-large');
    const label = document.getElementById('ss-status-label');
    const ver   = document.getElementById('ss-version');
    const sync  = document.getElementById('ss-last-sync');

    if (dot)   dot.className   = `w-5 h-5 rounded-full ${s.dot}`;
    if (label) { label.textContent = s.label; label.className = `text-lg font-bold ${s.labelCls}`; removeSkeleton(label); }
    if (ver)   { ver.textContent = data.version; removeSkeleton(ver); }
    if (sync)  { sync.textContent = fmtDatetime(data.lastSyncAt); removeSkeleton(sync); }
  } catch (e) {
    console.error('[server-status-page]', e);
  }
}

// ─────────────────────────────────────────────
// 초기화
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  // 사이드바 네비게이션
  document.querySelectorAll('[data-page]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(a.dataset.page);
    });
  });

  // 대시보드 검색바
  document.getElementById('search-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const q = document.getElementById('search-input')?.value.trim();
    if (q) navigateTo('user-search');
    // 검색 페이지에도 값 세팅 후 검색 실행
    const standaloneInput = document.getElementById('search-input-standalone');
    if (standaloneInput && q) { standaloneInput.value = q; handleUserSearch(q); }
  });

  // 유저 검색 독립 폼
  document.getElementById('search-form-standalone')?.addEventListener('submit', e => {
    e.preventDefault();
    const q = document.getElementById('search-input-standalone')?.value.trim();
    if (q) handleUserSearch(q);
  });

  // 뒤로가기 버튼
  document.getElementById('back-btn')?.addEventListener('click', () => {
    navigateTo(previousPage);
  });

  // 기간 필터 버튼
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      loadPlayStats();
    });
  });

  // 이벤트 더 보기 버튼
  document.getElementById('events-load-more')?.addEventListener('click', loadMoreEvents);

  // 첫 화면: 대시보드
  loadDashboard();
});

function _currentActivePage() {
  for (const p of PAGES) {
    const el = document.getElementById(`page-${p}`);
    if (el && !el.classList.contains('hidden')) return p;
  }
  return 'dashboard';
}
