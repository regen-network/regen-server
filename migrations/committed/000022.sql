--! Previous: sha1:0b254fb5914e2d94fd9c3b979dc240b547ddc702
--! Hash: sha1:1796a6a17e1cddfdf1faff0e4f9b918e9c6e6c73

-- Enter migration here
CREATE OR REPLACE FUNCTION migrate_roles() RETURNS void AS $$
    DECLARE
        temprow record;
    BEGIN
        FOR temprow IN
            select rolname as current_role, party.id as new_role from pg_roles join wallet on wallet.addr = rolname join party on party.wallet_id=wallet.id where rolname like 'regen%'
         LOOP
            RAISE LOG 'MIGRATE_ROLES::record % -> %', temprow.current_role, temprow.new_role;
            BEGIN
                PERFORM private.create_auth_user(temprow.new_role::text);
            EXCEPTION WHEN duplicate_object THEN
            END;
            EXECUTE format('DROP ROLE IF EXISTS %I', temprow.current_role);
         END LOOP;
    END;
$$ LANGUAGE plpgsql;

SELECT migrate_roles();

DROP FUNCTION IF EXISTS migrate_roles();
