/**
 * Chronos Admin — 플레이 통계 (stats.html?period=today|7d|30d)
 */
(function () {
  'use strict';

  const F = window.Fmt;
  const COLS = 6;

  let data = null;          // 마지막 응답 (난이도 탭·테마 전환에서 재사용)
  let difficulty = 'ALL';   // 현재 난이도 탭

  // ─────────────────────────────────────────────
  // 기간
  // ─────────────────────────────────────────────

  function periodToDates(period) {
    const today = new Date();
    const to = F.dateStr(today);
    const daysAgo = n => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return F.dateStr(d);
    };
    if (period === 'today') return { from: to, to, label: '오늘' };
    if (period === '30d')   return { from: daysAgo(29), to, label: '최근 30일' };
    return                         { from: daysAgo(6),  to, label: '최근 7일' };  // 기본 7일
  }

  // ─────────────────────────────────────────────

  async function load() {
    window.Shell.loadServerStatus();

    const period = new URLSearchParams(location.search).get('period') || '7d';
    const range = periodToDates(period);

    document.querySelectorAll('#period-seg .seg-btn').forEach(a => {
      a.classList.toggle('active', a.dataset.period === period);
    });
    const sub = document.getElementById('stats-range');
    if (sub) sub.textContent = `층별 도달율과 클리어율 — ${range.label} (${range.from} ~ ${range.to})`;

    const tbody = document.getElementById('floors-table-body');
    tbody.innerHTML = F.loadingRow(COLS);

    try {
      data = await window.Api.floors(range.from, range.to);
      renderDifficultyTabs();
      renderAll();
    } catch (e) {
      console.error('[floors]', e);
      tbody.innerHTML = F.errorRow(COLS);
      ['kpi-total-runs', 'kpi-deepest', 'kpi-wall', 'kpi-avg-clear'].forEach(id => F.setError(id, '—'));
    }
  }

  /** 응답에 실제로 들어있는 난이도만 탭으로 만든다. 없으면 탭 자체를 숨긴다. */
  function renderDifficultyTabs() {
    const seg = document.getElementById('difficulty-seg');
    if (!seg) return;

    const keys = Object.keys(data.totalRunsByDifficulty || {});
    if (!keys.length) { seg.classList.add('hidden'); return; }

    seg.classList.remove('hidden');
    seg.innerHTML = [
      `<button type="button" class="seg-btn active" data-diff="ALL">전체</button>`,
      ...keys.map(k => `<button type="button" class="seg-btn" data-diff="${F.esc(k)}">${F.esc(F.difficulty(k))}</button>`),
    ].join('');

    seg.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        difficulty = btn.dataset.diff;
        seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderAll();
      });
    });
  }

  /** 현재 탭에 해당하는 층 목록과 분모(전체 런 수)를 고른다. */
  function currentView() {
    if (difficulty === 'ALL') {
      return { rows: data.floors || [], totalRuns: data.totalRuns || 0 };
    }
    return {
      rows: (data.floorsByDifficulty || []).filter(r => r.difficulty === difficulty),
      totalRuns: (data.totalRunsByDifficulty || {})[difficulty] || 0,
    };
  }

  function renderAll() {
    const view = currentView();
    renderKpi(view);
    renderChart(view);
    renderTable(view);
  }

  // ─────────────────────────────────────────────
  // KPI
  // ─────────────────────────────────────────────

  function renderKpi(view) {
    const { rows, totalRuns } = view;

    F.setText('kpi-total-runs', F.num(totalRuns));
    const sub = document.getElementById('kpi-total-runs-sub');
    if (sub) sub.textContent = difficulty === 'ALL' ? 'RUN_START 기준' : `${F.difficulty(difficulty)} 난이도`;

    if (!rows.length) {
      ['kpi-deepest', 'kpi-wall', 'kpi-avg-clear'].forEach(id => F.setText(id, '—'));
      document.getElementById('kpi-wall-sub').textContent = '클리어율이 가장 낮은 구간';
      return;
    }

    // 최고 도달: 진입 기록이 하나라도 있는 가장 깊은 지점.
    // round는 VARCHAR라 숫자가 아닐 수 있어(예: 'BOSS') 숫자로 읽히는 것만 비교에 쓴다.
    const roundNo = r => (/^\d+$/.test(String(r.round)) ? Number(r.round) : -1);
    const deepest = rows.reduce((a, b) => {
      if (b.floor !== a.floor) return b.floor > a.floor ? b : a;
      return roundNo(b) > roundNo(a) ? b : a;
    });
    F.setText('kpi-deepest', deepest.label);

    // 가장 많이 막히는 곳: 도달이 어느 정도 있는 구간 중 클리어율 최저
    // (한두 명만 들어간 구간이 0%로 뽑혀 1위가 되는 걸 막으려고 최소 도달 수를 건다)
    const floor = Math.max(3, Math.round(totalRuns * 0.05));
    const meaningful = rows.filter(r => r.entered >= floor);
    const wall = (meaningful.length ? meaningful : rows).reduce((a, b) => (b.clearRate < a.clearRate ? b : a));
    F.setText('kpi-wall', wall.label);
    document.getElementById('kpi-wall-sub').textContent = `클리어율 ${F.pct(wall.clearRate)} · 도달 ${F.num(wall.entered)}`;

    // 평균 클리어 시간: 구간별 평균을 클리어 수로 가중 평균
    let sum = 0, weight = 0;
    rows.forEach(r => {
      if (r.avgClearMs != null && r.cleared > 0) { sum += r.avgClearMs * r.cleared; weight += r.cleared; }
    });
    F.setText('kpi-avg-clear', weight ? F.ms(sum / weight) : '—');
  }

  // ─────────────────────────────────────────────
  // 곡선
  // ─────────────────────────────────────────────

  function renderChart(view) {
    const { rows, totalRuns } = view;
    const canvas = document.getElementById('floors-chart');
    const emptyEl = document.getElementById('floors-chart-empty');

    if (!rows.length) {
      window.Charts.instances.get('floors-chart')?.destroy();
      canvas.parentElement.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      emptyEl.innerHTML = F.emptyHtml('이 기간에 층 기록이 없습니다', '기간을 넓혀보세요');
      return;
    }
    canvas.parentElement.classList.remove('hidden');
    emptyEl.classList.add('hidden');

    const c = window.Charts.colors();
    const denom = totalRuns || 1;

    window.Charts.render('floors-chart', {
      type: 'line',
      data: {
        labels: rows.map(r => r.label),
        datasets: [
          {
            label: '클리어율',
            data: rows.map(r => +(r.clearRate * 100).toFixed(1)),
            borderColor: `rgb(${c.accent})`,
            backgroundColor: `rgba(${c.accent}, 0.1)`,
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.3,
          },
          {
            label: '도달율',
            data: rows.map(r => +Math.min((r.entered / denom) * 100, 100).toFixed(1)),
            borderColor: `rgb(${c.success})`,
            backgroundColor: `rgba(${c.success}, 0.06)`,
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 3,
            pointHoverRadius: 5,
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
            ...window.Charts.tooltipStyle(),
            displayColors: true,
            callbacks: {
              label: item => ` ${item.dataset.label}: ${item.raw}%`,
              afterBody(items) {
                const r = rows[items[0].dataIndex];
                return [
                  `도달 런: ${F.num(r.entered)} / ${F.num(denom)}`,
                  `평균 클리어: ${F.ms(r.avgClearMs)}`,
                ];
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: { min: 0, max: 100, ticks: { callback: v => `${v}%` } },
        },
      },
    });
  }

  // ─────────────────────────────────────────────
  // 표
  // ─────────────────────────────────────────────

  function renderTable(view) {
    const tbody = document.getElementById('floors-table-body');
    if (!tbody) return;

    if (!view.rows.length) {
      tbody.innerHTML = F.emptyRow(COLS, '이 기간에 층 기록이 없습니다');
      return;
    }

    tbody.innerHTML = view.rows.map(r => {
      const cls = r.clearRate >= 0.8 ? 'text-emerald-400' : r.clearRate >= 0.6 ? 'text-amber-400' : 'text-rose-400';
      return `
        <tr>
          <td class="font-semibold text-slate-200">${F.esc(r.label)}</td>
          <td class="num text-slate-400">${F.num(r.entered)}</td>
          <td class="num text-slate-400">${F.num(r.cleared)}</td>
          <td class="num font-semibold ${cls}">${F.pct(r.clearRate)}</td>
          <td class="num text-muted">${F.num(r.deaths)}</td>
          <td class="num text-slate-400">${F.ms(r.avgClearMs)}</td>
          <td class="num text-muted">${F.oc(r.avgEnterOc)}</td>
        </tr>`;
    }).join('');
  }

  // ─────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', load);
  document.addEventListener('chronos:theme', () => { if (data) renderChart(currentView()); });
}());
