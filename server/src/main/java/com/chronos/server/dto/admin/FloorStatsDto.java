package com.chronos.server.dto.admin;

import java.util.List;
import java.util.Map;

/**
 * 층별 도달/클리어 집계.
 *
 * floors           = 난이도 구분 없이 합산 (기존 화면이 쓰는 값 — 구조 변경 없음)
 * floorsByDifficulty = 난이도별로 분해 (신규. 난이도별 곡선 비교용)
 *
 * ⚠️ round는 이벤트마다 체계가 다르다(client-log-spec 3장 ①).
 *    FLOOR_ENTER = 물리 라운드(셔플된 씬 번호), FLOOR_CLEAR = 논리 라운드(진행 순번).
 *    따라서 round 단위 clearRate는 분모/분자의 기준이 어긋나 있다.
 *    진행도를 정확히 보려면 floor 단위로 합산해서 볼 것.
 */
public record FloorStatsDto(
        long totalRuns,
        Map<String, Long> totalRunsByDifficulty,
        List<FloorRow> floors,
        List<FloorRow> floorsByDifficulty
) {
    /**
     * @param difficulty floors에서는 null, floorsByDifficulty에서만 채워진다.
     * @param round      스키마가 VARCHAR라 String. 숫자가 아닌 값도 올 수 있다.
     * @param avgDeaths  현재 클라가 deathsInFloor를 항상 0으로 보낸다(3장 ②). 사실상 0.
     */
    public record FloorRow(
            int floor,
            String round,
            String label,
            String difficulty,
            long entered,
            long cleared,
            double clearRate,
            Long avgClearMs,
            Double avgDeaths
    ) {}
}
