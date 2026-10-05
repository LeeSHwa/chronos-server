/**
 * Chronos Admin — 게임 데이터 이름표
 *
 * 로그에는 숫자 id만 들어온다(`templateId: 11001`, `killerId: 2100`).
 * 숫자를 사람이 읽는 이름으로 바꾸는 표를 여기 모아둔다.
 *
 * 서버·DB는 건드리지 않는다. 이름은 기획이 바꾸면 따라 바뀌는 값이고, 로그는 숫자를
 * 그대로 보존하는 게 맞기 때문이다. 이름이 바뀌면 이 파일 한 줄만 고치면 된다.
 * (나중에 SQL 콘솔에서 이름으로 조회하고 싶어지면 그때 DB 참조 테이블로 올리면 된다.)
 *
 * 모르는 id가 들어오면 숫자를 그대로 보여준다 — 표가 비어 있다고 화면이 깨지면 안 된다.
 */
(function () {
  'use strict';

  /** 장비 (ITEM_NAME_*) */
  const WEAPONS = {
    11001: '학살',
    11002: '어비셜 완드',
    11003: '차원의 파편',
    11004: '예리',
    11005: '어비셜 렐릭',
    11006: '태초의 의지',
    19001: '예견된 종말',
    19002: '이상현상',
    19003: '태풍의 눈',
  };

  /** 룬 */
  const RUNES = {
    21001: '계절의 파편',
    21002: '강력한 계절의 파편',
  };

  /** 소모품·토큰 */
  const CONSUMABLES = {
    30001: '토큰 30001',
    30002: '토큰 30002',
  };

  const SEASONS = {
    SPRING: '봄',
    SUMMER: '여름',
    AUTUMN: '가을',
    WINTER: '겨울',
  };

  /**
   * 적. killerId에 들어온다.
   * 표시용 한글 이름이 아직 없어서 클라 내부 이름을 그대로 쓴다.
   */
  const ENEMIES = {
    2001: 'F1_A1',
    2002: 'F_T',
    2003: 'F1_X',
    2010: 'F1_G',
    2100: 'F1_B (보스)',
    3001: 'F2_A',
    3002: 'F2_B',
    3010: 'F2_N',
    9001: 'TestMob',
    10001: 'TranningDummy',
  };

  /**
   * 증강. 이름표가 아직 없다.
   *
   * 알고 있는 것은 전투 갈래 3종뿐이라 그것만 채워두고, 나머지는 받는 대로 추가한다.
   * 비어 있으면 화면에 `증강 #14` 형태로 나온다.
   */
  const AUGMENTS = {
    10: '전환 (Conversion)',
    11: '정밀 조준 (Precision Targeting)',
    12: '특수 사격 (Special Shot)',
  };

  /** 공격 타입 (RUN_START.attackType) */
  const ATTACK_TYPES = {
    SPECIAL_SHOT: '특수 사격',
    PRECISION_TARGETING: '정밀 조준',
    CONVERSION: '전환',
    NONE: '미선택',
  };

  function lookup(table, id, prefix) {
    if (id == null) return '—';
    const name = table[id];
    return name ? `${name}` : `${prefix} #${id}`;
  }

  window.Catalog = {
    weapon:     id => lookup(WEAPONS, id, '장비'),
    rune:       id => lookup(RUNES, id, '룬'),
    consumable: id => lookup(CONSUMABLES, id, '소모품'),
    enemy:      id => lookup(ENEMIES, id, '적'),
    augment:    id => lookup(AUGMENTS, id, '증강'),
    season:     code => SEASONS[code] || code || '—',
    attackType: code => ATTACK_TYPES[code] || code || '—',
    tables: { WEAPONS, RUNES, CONSUMABLES, ENEMIES, AUGMENTS, SEASONS, ATTACK_TYPES },
  };
}());
