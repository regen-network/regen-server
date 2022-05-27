DO $$
BEGIN
    ALTER TABLE party
        ADD COLUMN account_id uuid;
EXCEPTION
    WHEN duplicate_column THEN
        RAISE NOTICE 'Field already exists. Ignoring...';
    END$$;
    DO
$$
BEGIN
    ALTER TABLE party
        ADD CONSTRAINT party_account_id_fkey FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE CASCADE;

EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Constraint already exists. Ignoring...';

END$$;
