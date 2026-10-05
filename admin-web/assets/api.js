/**
 * Chronos Admin — API 호출
 *
 * 백엔드 엔드포인트는 전부 여기를 거친다. 페이지 스크립트는 fetch를 직접 부르지 않는다.
 * 명세: docs/admin-spec.md
 *
 * (구 app.js에 있던 USE_MOCK / MOCK_* 더미 데이터는 걷어냈다. 백엔드가 실제로 붙은 뒤로
 *  한 번도 켜지지 않았고, 스키마가 timestamp → clientTime/serverTime 으로 바뀌면서
 *  실제 응답과도 어긋나 있어서 오히려 오해를 만드는 상태였다.)
 */
(function () {
  'use strict';

  /**
   * 이 페이지를 내려준 호스트의 8080 포트를 가리킨다.
   *
   * 주소를 하드코딩하지 않는 이유:
   *   로컬에서 열면  http://localhost:8080
   *   서버에서 열면  http://<서버 공인 IP>:8080
   * 로 자동으로 맞춰지므로, 배포 환경마다 파일을 고칠 필요가 없다.
   *
   * 'localhost:8080' 으로 박아두면 서버에 올렸을 때 브라우저가
   * "접속한 사람의 PC"를 찾게 되어 데이터를 못 불러온다.
   */
  const BASE_URL = `${location.protocol}//${location.hostname}:8080`;

  /** 서버가 죽었을 때 스피너가 영원히 도는 걸 막는다. */
  const TIMEOUT_MS = 8000;

  async function fetchJSON(path) {
    // Content-Type 헤더를 붙이면 GET이 'simple request'에서 벗어나 매 호출마다
    // CORS preflight(OPTIONS)가 한 번씩 더 나간다. 본문 없는 GET엔 의미도 없어서 뺐다.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE_URL}${path}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`${res.status} — ${path}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  window.Api = {
    BASE_URL,

    overview()        { return fetchJSON('/api/admin/stats/overview'); },
    serverStatus()    { return fetchJSON('/api/admin/server/status'); },
    floors(from, to)  { return fetchJSON(`/api/admin/stats/floors?from=${from}&to=${to}`); },

    userSearch(q)     { return fetchJSON(`/api/admin/users/search?q=${encodeURIComponent(q)}`); },
    userDetail(id)    { return fetchJSON(`/api/admin/users/${encodeURIComponent(id)}`); },
    userEvents(id, cursor) {
      const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=50` : '?limit=50';
      return fetchJSON(`/api/admin/users/${encodeURIComponent(id)}/events${q}`);
    },
  };
}());
