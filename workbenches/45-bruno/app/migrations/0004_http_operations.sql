CREATE TABLE http_operations (
 id TEXT PRIMARY KEY,
 document_id TEXT NOT NULL,
 request_fingerprint TEXT NOT NULL,
 payload TEXT NOT NULL
);
