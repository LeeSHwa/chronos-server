package com.chronos.server.service;

import com.chronos.server.domain.ClientLog;
import com.chronos.server.dto.ClientLogRequest;
import com.chronos.server.repository.LogRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class LogService {

    private final LogRepository logRepository;

    public LogService(LogRepository logRepository) {
        this.logRepository = logRepository;
    }

    public void saveAll(List<ClientLogRequest> requests) {
        for (ClientLogRequest request : requests) {
            ClientLog log = ClientLog.builder()
                    .userId(request.getUserId())
                    .eventType(request.getEventType())
                    .timestamp(request.getTimestamp())
                    .runId(request.getRunId())
                    .floor(request.getFloor())
                    .round(request.getRound())
                    .payload(request.getPayload())
                    .difficulty(request.getDifficulty())
                    .build();

            logRepository.save(log);
        }
    }
}
