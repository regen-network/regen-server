ALTER TABLE project DROP COLUMN IF EXISTS creator_id CASCADE;

DO $$
BEGIN
    ALTER TABLE project
        ADD COLUMN admin_wallet_id uuid;
EXCEPTION
    WHEN duplicate_column THEN
        RAISE NOTICE 'Field already exists. Ignoring...';
END$$;

DO $$
BEGIN
    ALTER TABLE project
        ADD CONSTRAINT project_admin_wallet_id_fkey FOREIGN KEY (admin_wallet_id) REFERENCES wallet (id);
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Constraint already exists. Ignoring...';
END$$;

CREATE INDEX IF NOT EXISTS project_admin_wallet_id_idx ON project (admin_wallet_id);

-- Deprecate the wallet_id column in favor of the new admin_wallet_id column
-- Before removing the column, copy any existing data from the existing wallet_id column:
UPDATE project SET admin_wallet_id = wallet_id;
ALTER TABLE project DROP COLUMN wallet_id;

DROP POLICY IF EXISTS project_app_user_create ON project;
DROP POLICY IF EXISTS project_insert_admin ON project;
DROP POLICY IF EXISTS project_delete_admin ON project;
DROP POLICY IF EXISTS project_app_user_update ON project;

-- NOTE: since this versioned migration depends on get_current_addrs and flyway
-- runs versioned prior to the repeatable migration that defines
-- get_current_addrs, we must specify a definition for this function in this
-- migration.
--
-- if you need to make changes to get_current_addrs, do not
-- change it here.  modify it in the repeatable migration file instead,
-- R__get_current_addrs.sql.
CREATE OR REPLACE FUNCTION get_current_addrs ()
    RETURNS TABLE (
        wallet_id uuid,
        addr text,
        profile_type party_type
    )
    AS $$ 
DECLARE
    v_account_id uuid;
BEGIN
    SELECT * INTO v_account_id FROM get_current_account();
    RETURN query
    SELECT
        wallet.id, wallet.addr, party.type
    FROM
        account
        JOIN party ON party.account_id = account.id
        JOIN wallet ON party.wallet_id = wallet.id
    WHERE
        account.id = v_account_id;
END;
$$
LANGUAGE plpgsql STABLE;

DROP POLICY IF EXISTS project_insert_policy ON project;
CREATE POLICY project_insert_policy ON project
    FOR INSERT TO auth_user
        WITH CHECK (admin_wallet_id in (
            SELECT
                wallet_id
            FROM
                get_current_addrs()
        ));

DROP POLICY IF EXISTS project_update_policy ON project;
CREATE POLICY project_update_policy ON project
    FOR UPDATE TO auth_user
        USING (admin_wallet_id in (
            SELECT
                wallet_id
            FROM
                get_current_addrs()
        ))
        WITH CHECK (true);
