package com.chronos.server.controller;

import com.chronos.server.dto.ClientLogRequest;
import com.chronos.server.service.LogService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/logs")
public class LogController {

    private final LogService logService;

    public LogController(LogService logService) {
        this.logService = logService;
    }

    @PostMapping
    public void collectLogs(@RequestBody List<ClientLogRequest> requests) {
        logService.saveAll(requests);
    }
}
