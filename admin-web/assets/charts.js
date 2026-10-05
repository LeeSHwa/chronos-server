/**
 * Chronos Admin — Chart.js 공통 설정
 *
 * 차트를 쓰는 페이지(대시보드, 플레이 통계)만 이 파일을 읽는다.
 */
(function () {
  'use strict';

  /** 테마에 맞춘 축·격자 색. 차트를 그리기 직전마다 부른다. */
  function applyDefaults() {
    const isLight = document.documentElement.classList.contains('light');
    Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
    Chart.defaults.color       = isLight ? '#64748b' : '#4a5068';
    Chart.defaults.borderColor = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
  }

  /** 팔레트. CSS 변수는 Chart.js가 못 읽으므로 여기서 실제 값으로 돌려준다. */
  function colors() {
    const isLight = document.documentElement.classList.contains('light');
    return {
      accent:  isLight ? '109, 95, 245' : '124, 110, 245',
      success: '52, 211, 153',
      warn:    '251, 191, 36',
      danger:  '244, 63, 94',
      sky:     '56, 189, 248',
    };
  }

  /**
   * 같은 canvas에 다시 그리기 전에 이전 인스턴스를 없앤다.
   * 안 그러면 Chart.js가 "Canvas is already in use" 로 죽는다.
   */
  const instances = new Map();

  function render(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    instances.get(canvasId)?.destroy();
    applyDefaults();
    const chart = new Chart(canvas, config);
    instances.set(canvasId, chart);
    return chart;
  }

  /** 툴팁 공통 모양. 기본값은 배경이 너무 밝아서 다크 테마에서 튄다. */
  function tooltipStyle() {
    const isLight = document.documentElement.classList.contains('light');
    return {
      backgroundColor: isLight ? 'rgba(15,23,42,0.92)' : 'rgba(26,30,41,0.96)',
      borderColor: isLight ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      padding: 10,
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
      displayColors: false,
    };
  }

  window.Charts = { render, colors, applyDefaults, tooltipStyle, instances };
}());
