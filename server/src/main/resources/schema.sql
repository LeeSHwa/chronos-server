CREATE TABLE IF NOT EXISTS game_events (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT,
    event_type  VARCHAR(50) NOT NULL,
    client_time TIMESTAMPTZ,
    server_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    run_id      BIGINT,
    floor       INT,
    round       VARCHAR(20),
    difficulty VARCHAR(20),
    payload     JSONB
);