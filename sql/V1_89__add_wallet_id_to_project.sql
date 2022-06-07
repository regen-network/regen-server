DO $$
BEGIN
    ALTER TABLE project
        ADD COLUMN wallet_id uuid;
EXCEPTION
    WHEN duplicate_column THEN
        RAISE NOTICE 'Field already exists. Ignoring...';
END$$;

DO $$
BEGIN
    ALTER TABLE project
        ADD CONSTRAINT wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES wallet (id);
        CREATE INDEX IF NOT EXISTS project_wallet_id_idx ON project (wallet_id);
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Constraint already exists. Ignoring...';
END$$;
