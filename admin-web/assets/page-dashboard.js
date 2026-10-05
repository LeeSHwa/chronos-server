/**
 * Chronos Admin — 대시보드 (index.html)
 */
(function () {
  'use strict';

  const F = window.Fmt;
  let lastOverview = null;   // 테마가 바뀌면 차트를 같은 데이터로 다시 그린다

  // ─────────────────────────────────────────────
  // 로딩
  // ─────────────────────────────────────────────

  async function load() {
    const dateEl = document.getElementById('dashboard-date');
    if (dateEl) {
      dateEl.textContent = `Chronos 운영 현황 — ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    }

    window.Shell.loadServerStatus();

    try {
      const data = await window.Api.overview();
      lastOverview = data;
      renderKpi(data);
      renderTodayNotice(data);
      renderDauChart(data.dauSeries || []);
      renderHourlyChart(data.hourlyToday || []);
      renderDifficulty(data.difficultyToday || []);
      renderRecentUsers(data.recentUsers || []);
    } catch (e) {
      console.error('[overview]', e);
      ['kpi-plays', 'kpi-runs-started', 'kpi-runs-cleared', 'kpi-dau'].forEach(id => F.setError(id, '—'));

      // 차트 두 개는 canvas라 그리지 않으면 빈 칸만 남는다. 자리에 이유를 적어둔다.
      const fail = '<div class="empty text-rose-500">데이터를 불러올 수 없습니다.</div>';
      ['recent-users-list', 'difficulty-list'].forEach(id => {
        const node = document.getElementById(id);
        if (node) node.innerHTML = fail;
      });
      ['dau-chart', 'hourly-chart'].forEach(id => {
        const node = document.getElementById(id)?.parentElement;
        if (node) node.innerHTML = fail;
      });
    }
  }

  // ─────────────────────────────────────────────
  // KPI
  // ─────────────────────────────────────────────

  function renderKpi(d) {
    F.setText('kpi-plays',        F.num(d.playsToday));
    F.setText('kpi-runs-started', F.num(d.runsStartedToday));
    F.setText('kpi-runs-cleared', F.num(d.runsClearedToday));
    F.setText('kpi-dau',          F.num(d.dauToday));

    // 완주된 런 카드 밑에 완주율을 같이 보여준다. 숫자 하나만으로는 많은 건지 알 수 없다.
    const sub = document.getElementById('kpi-clear-rate');
    if (sub && d.runsStartedToday > 0) {
      sub.textContent = `시작 대비 ${F.pct(d.runsClearedToday / d.runsStartedToday)}`;
    }
  }

  /** 오늘 아무것도 안 들어왔으면 0이 늘어선 이유를 알려준다. */
  function renderTodayNotice(d) {
    const quiet = !d.playsToday && !d.runsStartedToday && !d.dauToday;
    document.getElementById('today-empty-notice')?.classList.toggle('hidden', !quiet);
  }

  // ─────────────────────────────────────────────
  // 접속 기기 추이 (14일)
  // ─────────────────────────────────────────────

  /**
   * 서버는 "이벤트가 있었던 날"만 돌려준다. 그대로 그리면 9/9 다음 점이 9/11이 되면서
   * 하루 건너뛴 구간이 직선으로 이어져, 데이터가 없던 날이 마치 완만한 증가처럼 보인다.
   * 빠진 날을 0으로 채워 14일 축을 항상 같은 간격으로 만든다.
   */
  function fillDays(series, days) {
    const byDate = new Map((series || []).map(p => [String(p.date), Number(p.dau)]));
    const out = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = F.dateStr(d);
      out.push({ date: key, dau: byDate.get(key) ?? 0 });
    }
    return out;
  }

  function renderDauChart(series) {
    const points = fillDays(series, 14);
    const c = window.Charts.colors();

    window.Charts.render('dau-chart', {
      type: 'line',
      data: {
        labels: points.map(p => p.date.slice(5)),  // 'MM-DD'
        datasets: [{
          data: points.map(p => p.dau),
          borderColor: `rgb(${c.accent})`,
          backgroundColor: `rgba(${c.accent}, 0.1)`,
          borderWidth: 2,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          pointBackgroundColor: `rgb(${c.accent})`,
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...window.Charts.tooltipStyle(),
            callbacks: {
              title: items => points[items[0].dataIndex].date,
              label: item => ` 기기 ${F.num(item.raw)}대`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
          // 0부터 그려야 "0인 날"과 "적은 날"이 눈으로 구분된다.
          y: { beginAtZero: true, ticks: { precision: 0, callback: v => F.num(v) } },
        },
      },
    });
  }

  // ─────────────────────────────────────────────
  // 시간대별
  // ─────────────────────────────────────────────

  function renderHourlyChart(hourly) {
    const wrap = document.getElementById('hourly-chart')?.parentElement;

    if (!hourly.length) {
      if (wrap) wrap.innerHTML = F.emptyHtml('오늘 이벤트가 없습니다', '이벤트가 들어오면 시간대별 분포가 여기 그려집니다');
      return;
    }

    // 서버는 이벤트가 있던 시(hour)만 준다. 0~23을 전부 채워야 축이 시간 순서대로 읽힌다.
    const plays  = new Array(24).fill(0);
    const events = new Array(24).fill(0);
    hourly.forEach(h => {
      plays[h.hour]  = Number(h.plays);
      events[h.hour] = Number(h.events);
    });

    const c = window.Charts.colors();
    window.Charts.render('hourly-chart', {
      type: 'bar',
      data: {
        labels: Array.from({ length: 24 }, (_, i) => `${i}시`),
        datasets: [
          {
            label: '판 수',
            data: plays,
            backgroundColor: `rgb(${c.accent})`,
            borderRadius: 3,
            order: 1,
          },
          {
            label: '이벤트 수',
            data: events,
            type: 'line',
            borderColor: 'rgb(74, 80, 104)',
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.3,
            yAxisID: 'y2',
            order: 0,
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
            ...window.Charts.tooltipStyle(),
            displayColors: true,
            callbacks: { label: item => ` ${item.dataset.label}: ${F.num(item.raw)}` },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
          y:  { beginAtZero: true, ticks: { precision: 0 } },
          // 이벤트 수는 판 수보다 자릿수가 커서 같은 축에 두면 막대가 안 보인다.
          y2: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { precision: 0 } },
        },
      },
    });
  }

  // ─────────────────────────────────────────────
  // 난이도별
  // ─────────────────────────────────────────────

  function renderDifficulty(rows) {
    const el = document.getElementById('difficulty-list');
    if (!el) return;

    if (!rows.length) {
      el.innerHTML = F.emptyHtml('오늘 플레이 기록이 없습니다');
      return;
    }

    const max = Math.max(...rows.map(r => Number(r.plays)), 1);
    el.innerHTML = rows.map(r => {
      const plays = Number(r.plays);
      const cleared = Number(r.cleared);
      const width = Math.max((plays / max) * 100, 2);
      const label = F.difficulty(r.difficulty);
      return `
        <div class="mb-4 last:mb-0">
          <div class="flex items-baseline justify-between mb-1.5">
            <span class="text-sm font-medium text-slate-200">${F.esc(label)}</span>
            <span class="text-xs text-muted">${F.num(plays)}판 · 완주 ${F.num(cleared)}</span>
          </div>
          <div class="h-2 rounded-full overflow-hidden" style="background: rgb(var(--surface-700))">
            <div class="h-full rounded-full" style="width: ${width}%; background: rgb(var(--accent))"></div>
          </div>
          <p class="mt-1 text-[11px] text-muted">완주율 ${plays ? F.pct(cleared / plays) : '—'}</p>
        </div>`;
    }).join('');
  }

  // ─────────────────────────────────────────────
  // 최근 접속 유저
  // ─────────────────────────────────────────────

  /**
   * 리포지토리가 user_id로 GROUP BY 하고 MAX(server_time) 으로 정렬해서 주므로
   * 유저당 한 줄이고, 같은 유저가 새 이벤트를 보내면 그 줄이 맨 위로 올라온다.
   * 프론트는 순서를 다시 만지지 않는다.
   */
  function renderRecentUsers(users) {
    const el = document.getElementById('recent-users-list');
    if (!el) return;

    if (!users.length) {
      el.innerHTML = F.emptyHtml('최근 접속한 유저가 없습니다');
      return;
    }

    el.innerHTML = users.map(u => {
      const dot = u.isOnline ? 'bg-emerald-400' : 'bg-surface-600';
      const online = u.isOnline ? ' title="최근 5분 내 이벤트 있음"' : '';
      return `
        <a href="user.html?id=${encodeURIComponent(u.userId)}"
           class="flex items-center gap-3 px-5 py-3 border-b border-surface-700 last:border-b-0 hover:bg-surface-700 transition-colors">
          ${F.avatarHtml(u.userId)}
          <div class="flex-1 min-w-0">
            <p class="text-slate-200 truncate">${F.userIdHtml(u.userId)}</p>
            <p class="text-xs text-muted">런 ${F.num(u.runCount)}회</p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <span class="text-xs text-muted">${F.esc(F.relative(u.lastSeenAt))}</span>
            <span class="w-1.5 h-1.5 rounded-full ${dot}"${online}></span>
          </div>
        </a>`;
    }).join('');
  }

  // ─────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', load);

  // 테마를 바꾸면 축·격자 색이 어긋나므로 같은 데이터로 다시 그린다.
  document.addEventListener('chronos:theme', () => {
    if (!lastOverview) return;
    renderDauChart(lastOverview.dauSeries || []);
    renderHourlyChart(lastOverview.hourlyToday || []);
  });
}());
