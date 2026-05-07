-- Allow 'failed' status untuk auto_queries + add error_reason column
-- Surfaces silent failures dari createHypeWatcher.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'auto_queries_status_check'
  ) THEN
    ALTER TABLE auto_queries DROP CONSTRAINT auto_queries_status_check;
  END IF;

  ALTER TABLE auto_queries
    ADD CONSTRAINT auto_queries_status_check
    CHECK (status IN ('active','cancelled','expired','failed'));
END
$$;

ALTER TABLE auto_queries
  ADD COLUMN IF NOT EXISTS error_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_auto_queries_status_only ON auto_queries(status);
