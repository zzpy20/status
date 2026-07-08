-- type: 'port' (default, existing behavior), 'http', or 'dns'.
-- config: JSON text holding type-specific *extra* fields only --
--   http: { "expectedStatus": "200", "keyword": "some text" } (both optional)
--   dns:  { "recordType": "A", "expectedValue": "1.2.3.4" } (expectedValue optional)
-- `host` doubles as the primary identifier for every type (URL for http,
-- hostname for dns, TCP host for port); `port` is an unused sentinel (0)
-- for non-port types.
ALTER TABLE targets ADD COLUMN type TEXT NOT NULL DEFAULT 'port';
ALTER TABLE targets ADD COLUMN config TEXT;
