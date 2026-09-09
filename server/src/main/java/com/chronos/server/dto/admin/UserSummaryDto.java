package com.chronos.server.dto.admin;

import java.time.LocalDateTime;

/**
 * 유저 단위 요약.
 *
 * ⚠️ userId는 기기 식별자라 전시장에서는 관람객 수백 명이 한 userId에 뭉친다.
 *    전시 중 지표로는 쓰지 말고, 전시 후 부스 PC 단위 분석에만 쓸 것.
 */
public record UserSummaryDto(
        String userId,
        long totalRuns,
        MaxFloor maxFloorReached,
        LocalDateTime lastSeenAt,
        Long avgRunTimeMs,
        Double winRate
) {
    /** round는 스키마가 VARCHAR라 String. */
    public record MaxFloor(int floor, String round, String label) {}
}
