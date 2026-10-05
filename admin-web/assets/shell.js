/**
 * Chronos Admin — 공통 셸 (상단 바 + 사이드바)
 *
 * 페이지가 여러 파일로 나뉘어 있어도 헤더·사이드바 HTML은 여기 한 군데만 있다.
 * 각 HTML은 <body data-page="..."> 로 자기가 어느 메뉴인지만 알려주면
 * 활성 표시는 이 스크립트가 붙인다.
 *
 * 왜 SPA를 안 쓰는가:
 *   예전에는 index.html 하나에 다섯 페이지를 전부 넣고 .hidden 을 토글했다.
 *   URL이 바뀌지 않으니 브라우저 입장에선 페이지가 하나뿐이었고,
 *   뒤로가기를 누르면 사이트 자체를 떠나버렸다. 파일을 나누면
 *   뒤로가기·새로고침·북마크·새 탭이 전부 브라우저 기본 동작으로 해결된다.
 */
(function () {
  'use strict';

  const ICON = {
    dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    users:     '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    stats:     '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    status:    '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  };

  /** 사이드바 구성. key는 body[data-page] 와 맞춘다. */
  const NAV = [
    { section: '개요',        items: [{ key: 'dashboard', href: 'index.html',  label: '대시보드' }] },
    { section: '유저',        items: [{ key: 'users',     href: 'users.html',  label: '유저 검색' }] },
    { section: '게임 데이터', items: [{ key: 'stats',     href: 'stats.html',  label: '플레이 통계' }] },
    { section: '시스템',      items: [{ key: 'status',    href: 'status.html', label: '서버 상태' }] },
  ];

  /** 유저 상세(user.html)는 자기 메뉴가 없다. 유저 검색을 켜둔 상태로 본다. */
  const NAV_ALIAS = { user: 'users' };

  function navIcon(key) {
    return `<svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[key]}</svg>`;
  }

  function headerHtml() {
    return `
      <header class="fixed top-0 left-0 right-0 z-50 h-14 flex items-center gap-3 px-4 sm:px-6
                     border-b border-surface-700 bg-surface-900/90 backdrop-blur-sm">
        <button type="button" id="sidebar-toggle"
                class="sidebar-toggle w-8 h-8 -ml-1 flex items-center justify-center rounded-md text-muted hover:text-slate-300 hover:bg-surface-700 transition-colors"
                aria-label="메뉴 열기">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <a href="index.html" class="flex items-center gap-2.5 min-w-0">
          <svg class="w-6 h-6 flex-shrink-0" style="color: rgb(var(--accent))" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span class="text-lg font-semibold tracking-widest text-white uppercase">Chronos</span>
          <span class="hidden sm:inline text-xs font-mono text-muted tracking-wider">Admin</span>
        </a>

        <div class="ml-auto flex items-center gap-3 sm:gap-5">
          <span id="server-version" class="hidden sm:inline text-xs font-mono text-muted skeleton">v0.0.0</span>
          <a href="status.html" class="flex items-center gap-2 hover:opacity-80 transition-opacity" title="서버 상태 보기">
            <span id="server-status-dot" class="w-2 h-2 rounded-full bg-surface-600"></span>
            <span id="server-status-text" class="text-xs text-slate-400">확인 중…</span>
          </a>
          <button type="button" id="theme-toggle" title="테마 전환" aria-label="테마 전환"
                  class="w-8 h-8 flex items-center justify-center rounded-md text-muted hover:text-slate-300 hover:bg-surface-700 transition-colors">
            <svg id="theme-icon-sun" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
            </svg>
            <svg id="theme-icon-moon" class="w-4 h-4 hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>
        </div>
      </header>`;
  }

  function sidebarHtml(current) {
    const active = NAV_ALIAS[current] || current;
    const sections = NAV.map(group => `
      <div class="px-4 pt-5 pb-2">
        <p class="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted">${group.section}</p>
      </div>
      <nav class="flex flex-col gap-0.5 px-2">
        ${group.items.map(item => `
          <a href="${item.href}" class="nav-item${item.key === active ? ' active' : ''}">
            ${navIcon(item.key)}${item.label}
          </a>`).join('')}
      </nav>`).join('');

    return `
      <aside class="app-sidebar" id="app-sidebar">
        ${sections}
        <div class="mt-auto px-4 py-5 border-t border-surface-700">
          <p class="text-[11px] text-muted leading-relaxed">
            마지막 동기화<br/>
            <span id="last-sync-time" class="font-mono text-slate-500">—</span>
          </p>
        </div>
      </aside>
      <div class="app-scrim hidden" id="app-scrim"></div>`;
  }

  // ─────────────────────────────────────────────
  // 테마
  // ─────────────────────────────────────────────

  function applyTheme(theme) {
    const isLight = theme === 'light';
    document.documentElement.classList.toggle('light', isLight);
    document.getElementById('theme-icon-sun')?.classList.toggle('hidden', isLight);
    document.getElementById('theme-icon-moon')?.classList.toggle('hidden', !isLight);
    // 차트는 색을 이미 그려둔 상태라 테마가 바뀌면 각 페이지가 다시 그려야 한다.
    document.dispatchEvent(new CustomEvent('chronos:theme', { detail: { isLight } }));
  }

  function initTheme() {
    const saved = localStorage.getItem('chronos-theme');
    const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved ?? (sysDark ? 'dark' : 'light'));

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      const next = document.documentElement.classList.contains('light') ? 'dark' : 'light';
      localStorage.setItem('chronos-theme', next);
      applyTheme(next);
    });

    // 사용자가 직접 고른 적이 없을 때만 OS 설정을 따라간다.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('chronos-theme')) applyTheme(e.matches ? 'dark' : 'light');
    });
  }

  // ─────────────────────────────────────────────
  // 상단 바 서버 상태
  // ─────────────────────────────────────────────

  const STATUS_MAP = {
    HEALTHY:  { dot: 'bg-emerald-500 animate-pulse', text: '서버 정상',   cls: 'text-slate-400' },
    DEGRADED: { dot: 'bg-amber-400 animate-pulse',   text: '서버 불안정', cls: 'text-amber-400' },
    DOWN:     { dot: 'bg-rose-500',                  text: '서버 다운',   cls: 'text-rose-400'  },
  };

  function renderTopBarStatus(data) {
    const s = STATUS_MAP[data?.status] ?? STATUS_MAP.DEGRADED;
    const dot  = document.getElementById('server-status-dot');
    const text = document.getElementById('server-status-text');
    const ver  = document.getElementById('server-version');
    const sync = document.getElementById('last-sync-time');

    if (dot)  dot.className = `w-2 h-2 rounded-full ${s.dot}`;
    if (text) { text.textContent = s.text; text.className = `text-xs ${s.cls}`; }
    if (ver)  { ver.textContent = data?.version ?? '—'; ver.classList.remove('skeleton'); }
    if (sync) sync.textContent = window.Fmt.datetime(data?.lastSyncAt);
  }

  function renderTopBarDown() {
    const dot  = document.getElementById('server-status-dot');
    const text = document.getElementById('server-status-text');
    const ver  = document.getElementById('server-version');
    if (dot)  dot.className = 'w-2 h-2 rounded-full bg-rose-500';
    if (text) { text.textContent = '연결 실패'; text.className = 'text-xs text-rose-400'; }
    if (ver)  { ver.textContent = '—'; ver.classList.remove('skeleton'); }
  }

  /**
   * 상단 바 상태를 채운다.
   *
   * 서버 상태 페이지는 같은 응답을 본문에도 써야 하므로, 여기서 받은 값을 돌려준다.
   * (같은 엔드포인트를 두 번 부르지 않기 위함)
   */
  async function loadServerStatus() {
    try {
      const data = await window.Api.serverStatus();
      renderTopBarStatus(data);
      return data;
    } catch (e) {
      console.error('[server-status]', e);
      renderTopBarDown();
      return null;
    }
  }

  // ─────────────────────────────────────────────
  // 사이드바 (좁은 화면)
  // ─────────────────────────────────────────────

  function initSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const scrim   = document.getElementById('app-scrim');
    const toggle  = document.getElementById('sidebar-toggle');

    const close = () => { sidebar?.classList.remove('open'); scrim?.classList.add('hidden'); };
    const open  = () => { sidebar?.classList.add('open');    scrim?.classList.remove('hidden'); };

    toggle?.addEventListener('click', () => {
      sidebar?.classList.contains('open') ? close() : open();
    });
    scrim?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  // ─────────────────────────────────────────────
  // 전체 ID 복사 (모든 페이지 공용, 이벤트 위임)
  // ─────────────────────────────────────────────

  function initCopy() {
    document.addEventListener('click', async e => {
      const btn = e.target.closest('[data-copy]');
      if (!btn) return;
      e.preventDefault();
      const ok = await window.Fmt.copyText(btn.dataset.copy);
      window.Fmt.toast(ok ? '전체 ID를 복사했습니다' : '복사에 실패했습니다');
    });
  }

  // ─────────────────────────────────────────────

  function mount() {
    const page = document.body.dataset.page || 'dashboard';
    document.body.insertAdjacentHTML('afterbegin', headerHtml() + sidebarHtml(page));
    initTheme();
    initSidebar();
    initCopy();
  }

  window.Shell = { mount, loadServerStatus, renderTopBarStatus, STATUS_MAP };

  document.addEventListener('DOMContentLoaded', mount);
}());
