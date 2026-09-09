package com.chronos.server.repository;

import com.chronos.server.domain.ClientLog;

public interface LogRepository {
    ClientLog save(ClientLog clientLog);
}
