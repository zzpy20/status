-- Pinned monitors sort to the top of the status page and admin list,
-- ahead of the default id order -- a lightweight alternative to full
-- drag-and-drop reordering.
ALTER TABLE targets ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
