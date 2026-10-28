CREATE UNIQUE INDEX deerflow_one_active_research ON deerflow_research_runs(project_id) WHERE phase IN ('creating_thread','submitting','unknown','pending','running');
