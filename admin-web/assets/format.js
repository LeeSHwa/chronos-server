/**
 * Chronos Admin — 표시 유틸리티
 *
 * 모든 페이지가 공유한다. window.Fmt 하나에만 이름을 올려서
 * 페이지 스크립트끼리 전역 변수가 부딪히지 않게 한다.
 */
(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // 숫자 / 문자
  // ─────────────────────────────────────────────

  function num(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('ko-KR');
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** 소수 1자리 (null 허용) — null.toFixed() 크래시 방지용 */
  function fixed1(v) {
    return (v == null || Number.isNaN(Number(v))) ? '—' : Number(v).toFixed(1);
  }

  /** 0~1 비율 → "12.3%" (null 허용) */
  function pct(ratio) {
    return (ratio == null || Number.isNaN(Number(ratio))) ? '—' : (Number(ratio) * 100).toFixed(1) + '%';
  }

  /** ms → "Xm YYs" (백엔드가 아직 못 채우는 집계값은 null로 온다) */
  function ms(v) {
    if (v == null || Number.isNaN(Number(v))) return '—';
    const s = Math.floor(Number(v) / 1000);
    const m = Math.floor(s / 60);
    return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  }

  /**
   * OC(오버클럭) 잔량 → 사람이 읽는 시간.
   *
   * 클라이언트는 0.1초 단위(deciseconds)로 보낸다. 게임 안에서 제한 시간이자 체력이라
   * "731"보다 "73.1초"가 읽힌다. 명세 1.8 참고.
   */
  function oc(deciseconds) {
    if (deciseconds == null || Number.isNaN(Number(deciseconds))) return '—';
    return `${(Number(deciseconds) / 10).toFixed(1)}초`;
  }

  /**
   * 난이도 코드 → 표시 이름.
   *
   * 서버는 upper()로 합쳐서 주고(클라 "LIMITED", 더미 "Limited"), 원본 이벤트는 대소문자가 섞여 있다.
   * 표기는 docs/event-catalog.md 의 Standard / Endless / Limited / Timeless 를 따른다.
   * 공식 한글 명칭이 없으므로 번역하지 않는다.
   */
  function difficulty(code) {
    if (code == null || code === '') return '미지정';
    const s = String(code);
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  // ─────────────────────────────────────────────
  // 시각
  // ─────────────────────────────────────────────

  /**
   * 서버 시각 문자열 → epoch ms.
   *
   * 백엔드는 타임존이 없는 로컬 ISO('2026-08-12T20:33:00')를 보낸다. JS는 이 형태를
   * 이미 '로컬 시각'으로 파싱하므로 그대로 넘기면 된다.
   * 예전처럼 'Z'를 덧붙이면 UTC로 해석돼 KST 기준 9시간 어긋났고, 그 결과 미래 시각이
   * 돼서 모든 이벤트가 '방금 전'으로 표시됐다.
   * 나중에 서버가 오프셋 포함 형태('...+09:00')로 바꿔도 Date가 그대로 처리한다.
   */
  function parseTime(iso) {
    if (iso == null) return NaN;
    return new Date(String(iso).replace(/(\.\d{3})\d*/, '$1')).getTime();
  }

  /** ISO → "3분 전" */
  function relative(iso) {
    const t = parseTime(iso);
    if (Number.isNaN(t)) return '—';
    const diff = Math.floor((Date.now() - t) / 1000);
    if (diff < 0)     return '방금 전';   // 클라·서버 시계가 살짝 어긋난 경우
    if (diff < 60)    return '방금 전';
    if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${Math.floor(diff / 86400)}일 전`;
  }

  /** ISO → "09.15. 20:50:54" */
  function datetime(iso) {
    const t = parseTime(iso);
    if (Number.isNaN(t)) return '—';
    return new Date(t).toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  /** ISO → "09.15. 20:50" (초 없이) */
  function datetimeShort(iso) {
    const t = parseTime(iso);
    if (Number.isNaN(t)) return '—';
    return new Date(t).toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  /** Date → 'YYYY-MM-DD'. toISOString()은 UTC라 새벽 시간대에 하루가 밀린다 → 로컬 기준으로 조립. */
  function dateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ─────────────────────────────────────────────
  // userId 표시
  // ─────────────────────────────────────────────

  /**
   * 19~20자리 userId를 칸에 들어가는 길이로 줄인다.
   *
   * 앞 5자(음수면 부호 포함)와 뒤 4자를 남긴다. 사람이 두 유저를 구분하기엔 충분하고,
   * 정확한 값이 필요하면 툴팁·복사 버튼·상세 페이지에서 전체를 볼 수 있다.
   */
  function userShort(id) {
    const s = String(id ?? '');
    if (s.length <= 11) return s;
    return `${s.slice(0, 5)}…${s.slice(-4)}`;
  }

  /**
   * userId 문자열 → 0~359 색상값.
   *
   * 같은 유저는 항상 같은 색을 갖는다. 숫자를 못 읽어도 목록에서 "아까 그 유저"를
   * 색으로 알아볼 수 있게 하려는 것. (djb2 해시)
   */
  function userHue(id) {
    const s = String(id ?? '');
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 360;
  }

  /** 아바타(색 원 + 사람 아이콘). 숫자를 넣으면 원 밖으로 넘치므로 넣지 않는다. */
  function avatarHtml(id) {
    const hue = userHue(id);
    return `<div class="avatar" style="background: hsl(${hue} 45% 42%)">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    </div>`;
  }

  /** 줄인 userId + 전체값 툴팁. 필요하면 복사 버튼도 같이. */
  function userIdHtml(id, opts) {
    const o = opts || {};
    const full = String(id ?? '');
    const span = `<span class="uid" title="${esc(full)}">${esc(userShort(full))}</span>`;
    if (!o.copy) return span;
    return `<span class="inline-flex items-center gap-1">${span}${copyButtonHtml(full)}</span>`;
  }

  function copyButtonHtml(value) {
    return `<button type="button" class="uid-copy" data-copy="${esc(value)}" title="전체 ID 복사" aria-label="전체 ID 복사">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    </button>`;
  }

  /**
   * 클립보드 복사.
   *
   * navigator.clipboard는 보안 컨텍스트(https 또는 localhost)에서만 존재한다.
   * 이 어드민은 http://<사설 IP>:8081 로 열리는 경우가 많아 그 API가 아예 없다.
   * 그래서 execCommand 폴백을 같이 둔다.
   */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* 폴백으로 내려간다 */ }

    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // 공용 DOM 조각
  // ─────────────────────────────────────────────

  const SPINNER = `<svg class="w-4 h-4 animate-spin inline-block mr-2" style="color: rgb(var(--accent))" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>`;

  function loadingRow(colspan, label) {
    return `<tr><td colspan="${colspan}" class="empty">${SPINNER}${esc(label || '불러오는 중…')}</td></tr>`;
  }

  function emptyRow(colspan, label, hint) {
    return `<tr><td colspan="${colspan}">${emptyHtml(label, hint)}</td></tr>`;
  }

  function errorRow(colspan, label) {
    return `<tr><td colspan="${colspan}" class="empty text-rose-500">${esc(label || '데이터를 불러올 수 없습니다.')}</td></tr>`;
  }

  /** 데이터가 0건일 때. 왜 비었는지 한 줄 덧붙일 수 있게 hint를 받는다. */
  function emptyHtml(label, hint) {
    return `<div class="empty">
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3h18v18H3zM3 9h18M9 21V9"/>
      </svg>
      <p>${esc(label)}</p>
      ${hint ? `<p class="mt-1 text-xs opacity-70">${esc(hint)}</p>` : ''}
    </div>`;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
    el.classList.remove('skeleton');
  }

  function setError(id, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = label || '—';
    el.classList.remove('skeleton');
    el.classList.add('text-rose-500');
  }

  function toast(message) {
    document.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  window.Fmt = {
    num, esc, fixed1, pct, ms, oc, difficulty,
    parseTime, relative, datetime, datetimeShort, dateStr,
    userShort, userHue, avatarHtml, userIdHtml, copyButtonHtml, copyText,
    SPINNER, loadingRow, emptyRow, errorRow, emptyHtml,
    setText, setError, toast,
  };
}());
