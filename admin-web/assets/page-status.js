/**
 * Chronos Admin — 서버 상태 (status.html)
 *
 * 상단 바와 같은 엔드포인트를 쓴다. Shell.loadServerStatus()가 상단 바를 채우고
 * 응답을 그대로 돌려주므로, 같은 호출을 두 번 하지 않는다.
 */
(function () {
  'use strict';

  const F = window.Fmt;
  const REFRESH_MS = 30000;

  const STATUS_VIEW = {
    HEALTHY: { dot: 'bg-emerald-500 animate-pulse', cls: 'text-emerald-400' },
    DOWN:    { dot: 'bg-rose-500',                  cls: 'text-rose-400'  },
  };

  async function refresh() {
    const data = await window.Shell.loadServerStatus();

    if (!data) {                       // 서버에 아예 닿지 못한 경우
      renderStatus('연결 실패', 'bg-amber-400', 'text-amber-400', '—');
      ['ss-last-event', 'ss-events-today', 'ss-events-total'].forEach(id => F.setText(id, '—'));
      F.setText('ss-last-event-abs', '서버 응답 없음');
      return;
    }

    const view = STATUS_VIEW[data.status] ?? { dot: 'bg-amber-400', cls: 'text-amber-400' };
    renderStatus(data.status, view.dot, view.cls, data.version);

    F.setText('ss-last-event',    F.relative(data.lastEventAt));
    F.setText('ss-last-event-abs', data.lastEventAt ? F.datetime(data.lastEventAt) : '수신된 이벤트 없음');
    F.setText('ss-events-today',  F.num(data.eventsToday));
    F.setText('ss-events-total',  F.num(data.eventsTotal));
  }

  function renderStatus(label, dotCls, textCls, version) {
    const dot = document.getElementById('ss-dot');
    if (dot) dot.className = `w-5 h-5 rounded-full ${dotCls}`;

    const el = document.getElementById('ss-status');
    if (el) {
      el.textContent = label;
      el.className = `text-xl font-bold ${textCls}`;
    }
    F.setText('ss-version', version ?? '—');
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ss-base-url').textContent = window.Api.BASE_URL;
    document.getElementById('refresh-btn')?.addEventListener('click', refresh);
    refresh();

    // 다른 탭으로 옮겨간 동안에는 굳이 폴링하지 않는다.
    setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
  });
}());
