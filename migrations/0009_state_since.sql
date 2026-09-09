-- Persists "when did this target enter its current confirmed state",
-- previously recomputed on every /monitor/:id view by findStateSince()
-- scanning raw `checks` with no time bound at all -- the last thing still
-- depending on indefinitely-old raw history after migration 0008's rollup
-- tables. Updated incrementally by openIncident()/closeIncident() (see
-- src/db.js) at the same moment they already write, instead of being
-- rederived. See docs/incidents/2026-09-06-d1-quota-exhaustion.md.
ALTER TABLE targets ADD COLUMN state_since INTEGER;
