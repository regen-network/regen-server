--! Previous: sha1:95217cabbcc6a585fc4d8c51a94932391ab75b8c
--! Hash: sha1:ef23be0e0e045be92fd69c1796ce5d906c769a8a

CREATE OR REPLACE FUNCTION temp_migration_helper() RETURNS void AS $$
    DECLARE
    BEGIN
        BEGIN
            ALTER TABLE organization RENAME CONSTRAINT organization_party_id_key TO organization_account_id_key;
        EXCEPTION WHEN undefined_object THEN
        END;
        BEGIN
            ALTER INDEX project_admin_party_id_idx RENAME TO project_admin_account_id_idx;
        EXCEPTION WHEN undefined_table THEN
        END;
    END;
$$ LANGUAGE plpgsql;

SELECT temp_migration_helper();
DROP FUNCTION IF EXISTS temp_migration_helper();
