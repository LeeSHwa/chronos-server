/**
 * Chronos Admin — 유저 상세 (user.html?id=<userId>)
 *
 * URL에는 줄이지 않은 전체 userId를 싣는다. 화면에 짧게 보여주는 것과 별개로
 * 주소는 정확해야 북마크·공유·새로고침이 같은 유저를 가리킨다.
 */
(function () {
  'use strict';

  const F = window.Fmt;
  const COLS = 6;                 // 이벤트 표 열 수 (colspan용)

  let userId = null;
  let cursor = null;
  let exhausted = false;

  // ─────────────────────────────────────────────

  async function load() {
    window.Shell.loadServerStatus();
    initBackButton();

    userId = (new URLSearchParams(location.search).get('id') || '').trim();
    const tbody = document.getElementById('events-table-body');

    if (!userId) {
      document.getElementById('user-id-full').innerHTML = '<span class="text-rose-500 text-sm">userId가 지정되지 않았습니다</span>';
      tbody.innerHTML = F.emptyRow(COLS, '주소에 ?id=<userId> 가 없습니다', '유저 검색에서 다시 들어와 주세요');
      return;
    }

    renderHeader(userId);
    document.title = `유저 ${F.userShort(userId)} — CHRONOS Admin`;
    tbody.innerHTML = F.loadingRow(COLS, '이벤트 불러오는 중…');

    const [summary, events] = await Promise.allSettled([
      window.Api.userDetail(userId),
      window.Api.userEvents(userId, null),
    ]);

    if (summary.status === 'fulfilled') {
      renderSummary(summary.value);
    } else {
      console.error('[user-detail]', summary.reason);
      ['ud-total-runs', 'ud-max-floor', 'ud-avg-run-time', 'ud-win-rate', 'ud-last-seen'].forEach(id => F.setError(id, '—'));
    }

    if (events.status === 'fulfilled') {
      cursor = events.value.nextCursor;
      exhausted = !cursor;
      renderEvents(events.value.events || [], false);
      document.getElementById('events-load-more-wrap')?.classList.toggle('hidden', exhausted);
    } else {
      console.error('[user-events]', events.reason);
      tbody.innerHTML = F.errorRow(COLS, '이벤트를 불러올 수 없습니다.');
    }
  }

  /**
   * 뒤로: 히스토리가 있으면 브라우저 뒤로가기, 없으면(주소창에 직접 붙여 넣고 들어온 경우)
   * 유저 검색으로 보낸다. history.back()만 부르면 그 경우 아무 일도 안 일어난다.
   */
  function initBackButton() {
    document.getElementById('back-btn')?.addEventListener('click', () => {
      if (document.referrer && history.length > 1) history.back();
      else location.href = 'users.html';
    });
  }

  function renderHeader(id) {
    document.getElementById('user-avatar').innerHTML = F.avatarHtml(id);
    document.getElementById('user-id-full').innerHTML =
      `<span class="uid-full">${F.esc(id)}</span>${F.copyButtonHtml(id)}`;
  }

  function renderSummary(d) {
    F.setText('ud-total-runs',   `${F.num(d.totalRuns)}회`);
    F.setText('ud-max-floor',    d.maxFloorReached?.label ?? '—');
    F.setText('ud-avg-run-time', F.ms(d.avgRunTimeMs));
    F.setText('ud-win-rate',     F.pct(d.winRate));

    const last = document.getElementById('ud-last-seen');
    if (last) {
      last.textContent = F.relative(d.lastSeenAt);
      last.title = F.datetime(d.lastSeenAt);
      last.classList.remove('skeleton');
    }
  }

  // ─────────────────────────────────────────────
  // 이벤트 표
  // ─────────────────────────────────────────────

  /** 로그 명세 v0.4의 이벤트 타입. 명세에 없는 타입이 들어와도 회색 배지로 그려진다. */
  const EVENT_BADGE = {
    ACCOUNT_LOGIN: 'bg-sky-900 text-sky-300',
    RUN_START:     'bg-emerald-900 text-emerald-300',
    RUN_RESUME:    'bg-teal-900 text-teal-300',
    RUN_END:       'bg-violet-900 text-violet-300',
    FLOOR_ENTER:   'bg-indigo-900 text-indigo-300',
    ROUND_ENTER:   'bg-blue-900 text-blue-300',
    ROUND_CLEAR:   'bg-green-900 text-green-300',
    PLAYER_DEATH:  'bg-rose-900 text-rose-300',
    CLIENT_ERROR:  'bg-red-900 text-red-300',
  };

  const DEATH_CAUSE = {
    DRAIN:   'OC 소진',
    COMBAT:  '피격',
    REFLECT: '보스 반사',
  };

  const RUN_RESULT = {
    WIN:   '클리어',
    DEATH: '사망',
    QUIT:  '포기',
  };

  /** build 객체 → "무기 3 · 룬 2 · 증강 4" 요약. 전체 내용은 아래 payload 보기에서 확인한다. */
  function buildSummary(b) {
    if (!b) return null;
    const parts = [];
    if (b.weapons?.length)   parts.push(`무기 ${b.weapons.length}`);
    if (b.runes?.length)     parts.push(`룬 ${b.runes.length}`);
    if (b.augments?.length)  parts.push(`증강 ${b.augments.reduce((n, a) => n + (a.stacks ?? 1), 0)}`);
    if (b.blessings?.length) parts.push(`가호 ${b.blessings.length}`);
    return parts.length ? parts.join(' · ') : '빈 빌드';
  }

  /** payload → 한 줄 요약 (로그 명세 v0.5의 key 기준) */
  function summarize(type, p) {
    if (!p) return '—';
    const join = (...parts) => parts.filter(Boolean).join(' · ');
    const C = window.Catalog;

    switch (type) {
      case 'ACCOUNT_LOGIN': return join(p.platform, p.clientVersion && `v${p.clientVersion}`, p.region);
      case 'RUN_START':     return join(C.attackType(p.attackType), p.clientVersion && `v${p.clientVersion}`);
      case 'RUN_RESUME':    return join('이어하기', F.ms(p.elapsedMs), `OC ${F.oc(p.overclockDeciseconds)}`);
      case 'RUN_END':       return join(RUN_RESULT[p.result] ?? p.result, `플레이 ${F.ms(p.elapsedMs)}`,
                                        `OC ${F.oc(p.overclockDeciseconds)}`, buildSummary(p.build));
      case 'FLOOR_ENTER':   return join(p.fieldCount != null && `필드 ${p.fieldCount}`,
                                        p.hasBoss != null && (p.hasBoss ? '보스 있음' : '보스 없음'));
      case 'ROUND_ENTER':   return join(p.mapId, `OC ${F.oc(p.overclockDeciseconds)}`);
      case 'ROUND_CLEAR':   return join(`클리어 OC ${F.oc(p.clearOverclockDeciseconds)}`,
                                        `플레이 ${F.ms(p.clearElapsedMs)}`, buildSummary(p.build));
      case 'PLAYER_DEATH':  return join(DEATH_CAUSE[p.deathCause] ?? p.deathCause,
                                        p.killerId != null && C.enemy(p.killerId), F.ms(p.elapsedMs));
      case 'CLIENT_ERROR':  return join(p.errorCode, p.message);
      default:              return JSON.stringify(p).slice(0, 80);
    }
  }

  // ─────────────────────────────────────────────
  // 펼친 상세 — 빌드를 이름으로 보여준다
  // ─────────────────────────────────────────────

  /** 로그에는 숫자 id만 들어오므로 Catalog로 이름을 붙여서 칩으로 그린다. */
  function buildDetailHtml(p) {
    const C = window.Catalog;
    const b = p.build;
    const sections = [];

    if (b?.weapons?.length) {
      sections.push(chipGroup('장비', b.weapons.map(w =>
        `${C.weapon(w.templateId)} <span class="chip-sub">${F.esc(w.rank ?? '?')}등급 · ${w.slot}번 칸</span>`)));
    }
    if (b?.runes?.length) {
      sections.push(chipGroup('룬', b.runes.map(r =>
        `${C.rune(r.templateId)}: ${C.season(r.season)} <span class="chip-sub">합성 ${r.fusionStack ?? 1} · ${r.slot}번 칸</span>`)));
    }
    if (b?.augments?.length) {
      sections.push(chipGroup('증강', b.augments.map(a =>
        `${C.augment(a.augmentId)} <span class="chip-sub">x${a.stacks ?? 1}</span>`)));
    }
    if (b?.blessings) {
      sections.push(chipGroup('가호', Object.entries(b.blessings).map(([k, v]) => `${F.esc(k)} <span class="chip-sub">${F.esc(String(v))}</span>`)));
    }

    // build 말고 남은 key들(시각·OC·원인 등)도 같이 보여준다.
    const rest = Object.entries(p).filter(([k]) => k !== 'build');
    if (rest.length) {
      sections.push(`<div class="detail-group"><h4>payload</h4><div class="detail-kv">${
        rest.map(([k, v]) => `<span><b>${F.esc(k)}</b> ${F.esc(typeof v === 'object' ? JSON.stringify(v) : String(v))}</span>`).join('')
      }</div></div>`);
    }

    return sections.length ? `<div class="detail">${sections.join('')}</div>` : '';
  }

  function chipGroup(title, items) {
    return `<div class="detail-group">
      <h4>${F.esc(title)}</h4>
      <div class="chips">${items.map(i => `<span class="chip-item">${i}</span>`).join('')}</div>
    </div>`;
  }

  function renderEvents(events, append) {
    const tbody = document.getElementById('events-table-body');
    if (!tbody) return;

    if (!append) tbody.innerHTML = '';
    if (!events.length && !append) {
      tbody.innerHTML = F.emptyRow(COLS, '이벤트가 없습니다', '이 userId로 수집된 로그가 아직 없습니다');
      return;
    }

    tbody.insertAdjacentHTML('beforeend', events.map(rowHtml).join(''));
  }

  /**
   * 행을 누르면 그 아래에 상세가 펼쳐진다.
   * 표 한 줄에 빌드를 다 적으면 읽을 수가 없어서, 요약은 한 줄로 두고 상세는 접어 둔다.
   */
  function initRowToggle() {
    document.getElementById('events-table-body')?.addEventListener('click', e => {
      const row = e.target.closest('tr.event-row');
      if (!row) return;

      const next = row.nextElementSibling;
      if (next?.classList.contains('detail-row')) {   // 이미 펼쳐져 있으면 접는다
        next.remove();
        row.classList.remove('expanded');
        return;
      }

      const html = row.dataset.detail;
      if (!html) return;
      row.insertAdjacentHTML('afterend', `<tr class="detail-row"><td colspan="${COLS}">${html}</td></tr>`);
      row.classList.add('expanded');
    });
  }

  function rowHtml(e) {
    const badge = EVENT_BADGE[e.eventType] ?? 'bg-surface-600 text-slate-400';
    const floor = (e.floor != null && e.round != null) ? `${e.floor}-${e.round}` : '—';

    // 서버 수신 시각을 표시하고 클라 시각은 툴팁에 둔다.
    // 둘이 크게 벌어지면 전송이 밀리고 있다는 뜻이다(배치 주기 15초라 십수 초 차이는 정상).
    const shown = e.serverTime ?? e.clientTime;
    const tip = e.clientTime ? `클라 시각: ${F.datetime(e.clientTime)}` : '클라 시각 없음';

    const detail = buildDetailHtml(e.payload || {});

    return `
      <tr class="event-row" data-detail="${F.esc(detail)}">
        <td class="font-mono text-[11px] text-slate-400 whitespace-nowrap" title="${F.esc(tip)}">${F.esc(F.datetime(shown))}</td>
        <td class="whitespace-nowrap"><span class="badge ${badge}">${F.esc(e.eventType)}</span></td>
        <td class="text-[11px] text-muted whitespace-nowrap">${e.difficulty ? F.esc(F.difficulty(e.difficulty)) : '—'}</td>
        <td class="text-slate-400 whitespace-nowrap">${F.esc(floor)}</td>
        <td class="text-[11px] text-muted">${e.runId != null ? `<span class="uid" title="${F.esc(String(e.runId))}">${F.esc(F.userShort(e.runId))}</span>` : '—'}</td>
        <td class="text-muted clip" title="${F.esc(summarize(e.eventType, e.payload))}">${F.esc(summarize(e.eventType, e.payload))}</td>
      </tr>`;
  }

  async function loadMore() {
    if (exhausted || !userId) return;
    const btn = document.getElementById('events-load-more');
    if (btn) btn.textContent = '불러오는 중…';
    try {
      const data = await window.Api.userEvents(userId, cursor);
      cursor = data.nextCursor;
      exhausted = !cursor;
      renderEvents(data.events || [], true);
      if (exhausted) document.getElementById('events-load-more-wrap')?.classList.add('hidden');
      else if (btn) btn.textContent = '더 보기 (50건)';
    } catch (e) {
      console.error('[load-more-events]', e);
      if (btn) btn.textContent = '오류 — 다시 시도';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('events-load-more')?.addEventListener('click', loadMore);
    initRowToggle();
    load();
  });
}());
