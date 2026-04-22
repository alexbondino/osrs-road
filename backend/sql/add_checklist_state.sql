-- Add checklist_state column to roadmap_progress to persist per-node checklist done states
ALTER TABLE roadmap_progress
  ADD COLUMN IF NOT EXISTS checklist_state jsonb NOT NULL DEFAULT '{}';
