package com.chronos.server.dto.admin;

import java.util.List;
import java.util.Map;

/**
 * 층별 도달/클리어 집계.
 *
 * floors           = 난이도 구분 없이 합산 (기존 화면이 쓰는 값 — 구조 변경 없음)
 * floorsByDifficulty = 난이도별로 분해 (신규. 난이도별 곡선 비교용)
 *
 * round는 모든 이벤트에서 진행 순서다(로그 명세 v0.6 1.3). 맵이 섞여도 "몇 번째 스테이지"로 센다.
 */
public record FloorStatsDto(
        long totalRuns,
        Map<String, Long> totalRunsByDifficulty,
        List<FloorRow> floors,
        List<FloorRow> floorsByDifficulty
) {
    /**
     * @param difficulty floors에서는 null, floorsByDifficulty에서만 채워진다.
     * @param round      스키마가 VARCHAR라 String. 필드는 "1"부터, 보스는 "B"(로그 명세 1.3).
     * @param entered    이 스테이지에 진입한 런의 수. 이어하기로 두 번 깨도 런 하나로 센다.
     * @param avgClearMs 스테이지 소요 시간 평균. ROUND_CLEAR와 ROUND_ENTER의 elapsedMs 차이로
     *                   서버가 계산한다. 상점·정비 시간은 섞이지 않는다.
     * @param deaths     이 스테이지에서 죽은 횟수. 죽으면 판이 끝나므로 곧 "여기서 끝난 판"의 수다.
     * @param avgEnterOc 진입 시점 OC 잔량 평균(0.1초 단위). 이 값이 낮은 구간이 실제로 위험한 구간이다.
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
            long deaths,
            Double avgEnterOc
    ) {}
}
