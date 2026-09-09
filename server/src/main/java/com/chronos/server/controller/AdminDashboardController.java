package com.chronos.server.controller;

import com.chronos.server.dto.admin.FloorStatsDto;
import com.chronos.server.dto.admin.OverviewDto;
import com.chronos.server.dto.admin.ServerStatusDto;
import com.chronos.server.dto.admin.UserEventsDto;
import com.chronos.server.dto.admin.UserSearchDto;
import com.chronos.server.dto.admin.UserSummaryDto;
import com.chronos.server.service.AdminDashboardService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminDashboardController {

    private final AdminDashboardService service;

    public AdminDashboardController(AdminDashboardService service) {
        this.service = service;
    }

    @GetMapping("/server/status")
    public ServerStatusDto getServerStatus() {
        return service.getServerStatus();
    }

    @GetMapping("/stats/overview")
    public OverviewDto getOverview() {
        return service.getOverview();
    }

    @GetMapping("/stats/floors")
    public FloorStatsDto getFloorStats(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return service.getFloorStats(from, to);
    }

    @GetMapping("/users/search")
    public UserSearchDto searchUsers(@RequestParam("q") String q) {
        return service.searchUsers(q);
    }

    @GetMapping("/users/{userId}")
    public ResponseEntity<UserSummaryDto> getUser(@PathVariable long userId) {
        return service.getUserSummary(userId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/users/{userId}/events")
    public UserEventsDto getUserEvents(
            @PathVariable long userId,
            @RequestParam(required = false) Long cursor,
            @RequestParam(required = false) Integer limit
    ) {
        return service.getUserEvents(userId, cursor, limit);
    }
}
