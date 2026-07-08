-- Populated only when is_up = 0 -- a short human-readable reason the check
-- failed (timeout, wrong status code, keyword missing, no DNS records,
-- etc.), used as an incident's "root cause" on the Incidents page.
ALTER TABLE checks ADD COLUMN fail_reason TEXT;
