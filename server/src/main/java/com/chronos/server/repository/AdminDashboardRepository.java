package com.chronos.server.repository;

import com.chronos.server.dto.admin.FloorStatsDto;
import com.chronos.server.dto.admin.OverviewDto;
import com.chronos.server.dto.admin.ServerStatusDto;
import com.chronos.server.dto.admin.UserEventsDto;
import com.chronos.server.dto.admin.UserSearchDto;
import com.chronos.server.dto.admin.UserSummaryDto;

import java.time.LocalDate;
import java.util.Optional;

public interface AdminDashboardRepository {
    OverviewDto getOverview();

    FloorStatsDto getFloorStats(LocalDate from, LocalDate to);

    UserSearchDto searchUsers(String prefix);

    Optional<UserSummaryDto> getUserSummary(long userId);

    UserEventsDto getUserEvents(long userId, Long cursor, int limit);

    /** 수집이 살아있는지 판단하는 값들. 전시 당일 가장 자주 조회된다. */
    ServerStatusDto.Collection getCollectionStats();
}
