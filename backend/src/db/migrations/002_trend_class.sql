-- Extend asset_class to allow 6 = trend market.
-- Mirrors smart contract change: programs/programs/tredie/src/instructions/create_market.rs
-- (asset_class <= 6).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'markets_asset_class_check'
  ) THEN
    ALTER TABLE markets DROP CONSTRAINT markets_asset_class_check;
  END IF;

  ALTER TABLE markets
    ADD CONSTRAINT markets_asset_class_check
    CHECK (asset_class BETWEEN 0 AND 6);
END
$$;
