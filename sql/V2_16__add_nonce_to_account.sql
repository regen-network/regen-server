DO $$
BEGIN
    ALTER TABLE account
        ADD COLUMN nonce text NOT NULL DEFAULT (md5(random()::text));
EXCEPTION
    WHEN duplicate_column THEN
        RAISE NOTICE 'Field already exists. Ignoring...';
    END$$;
