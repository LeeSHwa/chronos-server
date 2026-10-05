/**
 * Chronos Admin — 유저 검색 (users.html)
 *
 * 검색어는 URL 쿼리(?q=)에서 읽는다. 폼 제출은 그냥 GET이라 페이지가 새로 뜨고,
 * 이 스크립트는 뜬 주소에 적힌 검색어를 그대로 실행하기만 한다.
 */
(function () {
  'use strict';

  const F = window.Fmt;

  async function run() {
    window.Shell.loadServerStatus();

    const q = (new URLSearchParams(location.search).get('q') || '').trim();
    const input = document.getElementById('search-input');
    if (input) input.value = q;
    if (!q) return;   // 검색어가 없으면 HTML에 적힌 안내를 그대로 둔다

    document.title = `"${q}" 검색 — CHRONOS Admin`;

    const el = document.getElementById('search-results');
    el.innerHTML = `<div class="empty">${F.SPINNER}검색 중…</div>`;

    try {
      const data = await window.Api.userSearch(q);
      render(el, data.results || [], q);
    } catch (e) {
      console.error('[user-search]', e);
      el.innerHTML = '<div class="empty text-rose-500">검색 중 오류가 발생했습니다.</div>';
    }
  }

  function render(el, results, q) {
    if (!results.length) {
      el.innerHTML = F.emptyHtml(`"${q}" 로 시작하는 userId가 없습니다`, '앞자리를 줄여서 다시 찾아보세요');
      return;
    }

    el.innerHTML = `
      <div class="px-5 py-3 text-xs text-muted border-b border-surface-700">
        ${F.num(results.length)}명 찾음${results.length >= 50 ? ' (최대 50명까지 표시)' : ''}
      </div>
      <div class="tbl-scroll">
        <table class="tbl">
          <thead>
            <tr>
              <th>userId</th>
              <th class="num">런 수</th>
              <th class="num">마지막 접속</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${results.map(rowHtml).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function rowHtml(u) {
    return `
      <tr>
        <td>
          <div class="flex items-center gap-2.5">
            ${F.avatarHtml(u.userId)}
            ${F.userIdHtml(u.userId, { copy: true })}
          </div>
        </td>
        <td class="num text-slate-400">${F.num(u.runCount)}회</td>
        <td class="num text-muted" title="${F.esc(F.datetime(u.lastSeenAt))}">${F.esc(F.relative(u.lastSeenAt))}</td>
        <td class="num">
          <a href="user.html?id=${encodeURIComponent(u.userId)}"
             class="font-medium hover:underline whitespace-nowrap" style="color: rgb(var(--accent))">상세 →</a>
        </td>
      </tr>`;
  }

  document.addEventListener('DOMContentLoaded', run);
}());
