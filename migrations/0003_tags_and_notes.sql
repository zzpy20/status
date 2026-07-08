-- tags: comma-separated free text, e.g. "production, singapore, reality".
-- notes: free text, admin-only -- never exposed via the public status page,
-- /api/status, or /monitor/:id (see src/index.js, which strips it before
-- responding on those public routes).
ALTER TABLE targets ADD COLUMN tags TEXT;
ALTER TABLE targets ADD COLUMN notes TEXT;
