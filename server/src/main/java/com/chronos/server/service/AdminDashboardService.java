package com.chronos.server.service;

import com.chronos.server.dto.admin.FloorStatsDto;
import com.chronos.server.dto.admin.OverviewDto;
import com.chronos.server.dto.admin.ServerStatusDto;
import com.chronos.server.dto.admin.UserEventsDto;
import com.chronos.server.dto.admin.UserSearchDto;
import com.chronos.server.dto.admin.UserSummaryDto;
import com.chronos.server.repository.AdminDashboardRepository;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class AdminDashboardService {

    private static final String VERSION = "v1.0.0";

    private final AdminDashboardRepository repo;

    public AdminDashboardService(AdminDashboardRepository repo) {
        this.repo = repo;
    }

    /**
     * 서버 상태 + 수집 상태.
     *
     * status는 DB에 닿을 수 있는지만 본다. 최근 이벤트가 없다고 DEGRADED로 내리지 않는 이유는,
     * "관람객이 없어서 조용한 것"과 "수집이 끊긴 것"을 서버가 구분할 수 없기 때문이다.
     * lastEventAt을 그대로 노출하고 판단은 사람이 한다.
     */
    public ServerStatusDto getServerStatus() {
        try {
            ServerStatusDto.Collection c = repo.getCollectionStats();
            return new ServerStatusDto(
                    "HEALTHY", VERSION, LocalDateTime.now(),
                    c.lastEventAt(), c.eventsToday(), c.eventsTotal()
            );
        } catch (DataAccessException e) {
            // DB가 죽었거나 스키마가 어긋난 상태. 초록불을 켜면 안 된다.
            return new ServerStatusDto("DOWN", VERSION, LocalDateTime.now(), null, 0, 0);
        }
    }

    public OverviewDto getOverview() {
        return repo.getOverview();
    }

    public FloorStatsDto getFloorStats(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now();
        LocalDate effFrom = from != null ? from : today.minusDays(6);
        LocalDate effTo = to != null ? to : today;
        return repo.getFloorStats(effFrom, effTo);
    }

    public UserSearchDto searchUsers(String q) {
        String prefix = q == null ? "" : q.trim();
        return repo.searchUsers(prefix);
    }

    public Optional<UserSummaryDto> getUserSummary(long userId) {
        return repo.getUserSummary(userId);
    }

    public UserEventsDto getUserEvents(long userId, Long cursor, Integer limit) {
        int effLimit = (limit == null || limit <= 0) ? 50 : Math.min(limit, 100);
        return repo.getUserEvents(userId, cursor, effLimit);
    }
}
