CREATE TABLE run_commands (id TEXT PRIMARY KEY, input TEXT NOT NULL, payload TEXT NOT NULL);
CREATE TABLE run_observations (simulation_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
