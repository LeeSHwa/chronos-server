/**
 * Chronos Admin — 부팅 스크립트
 *
 * <head> 안에서 vendor/tailwind.js 바로 다음에, 동기로 실행된다.
 * 여기서 하는 일은 두 가지뿐이고 둘 다 "첫 화면이 그려지기 전"이어야 한다.
 *
 *  ① Tailwind 색 토큰 등록 — 이게 늦으면 bg-surface-800 같은 클래스가 한 프레임 비어 보인다.
 *  ② 저장된 테마 적용     — 이게 늦으면 라이트 테마 사용자에게 검은 화면이 번쩍인다.
 */
(function () {
  'use strict';

  // ① Tailwind (play CDN) 설정
  window.tailwind = window.tailwind || {};
  window.tailwind.config = {
    theme: {
      extend: {
        fontFamily: {
          // 오프라인 환경이라 웹폰트를 받지 않는다. Windows에선 Segoe UI / Consolas로 잡힌다.
          sans: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
          mono: ['ui-monospace', 'Consolas', 'monospace'],
        },
        colors: {
          surface: {
            900: 'rgb(var(--surface-900) / <alpha-value>)',
            800: 'rgb(var(--surface-800) / <alpha-value>)',
            700: 'rgb(var(--surface-700) / <alpha-value>)',
            600: 'rgb(var(--surface-600) / <alpha-value>)',
          },
          accent: {
            DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
            dim:     'rgb(var(--accent-dim) / <alpha-value>)',
          },
          muted: 'rgb(var(--muted) / <alpha-value>)',
        },
      },
    },
  };

  // ② 테마
  const saved = localStorage.getItem('chronos-theme');
  const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if ((saved ?? (sysDark ? 'dark' : 'light')) === 'light') {
    document.documentElement.classList.add('light');
  }
}());
