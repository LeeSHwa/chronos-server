package com.chronos.server.dto.admin;

import java.time.LocalDateTime;
import java.util.List;

public record UserSearchDto(List<Hit> results) {
    /** userId는 String. 이유는 OverviewDto.RecentUser 주석 참고. */
    public record Hit(String userId, long runCount, LocalDateTime lastSeenAt) {}
}
