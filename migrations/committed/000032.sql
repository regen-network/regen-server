--! Previous: sha1:e4097448a1587b5a4501be4963825b96f5e27794
--! Hash: sha1:b6e6afd558df8de31f583ceacedca491fe0c49f3

ALTER TABLE IF EXISTS party
RENAME TO account;

DROP FUNCTION IF EXISTS get_parties_by_name_or_addr(text);
CREATE OR REPLACE FUNCTION public.get_accounts_by_name_or_addr(input text) RETURNS SETOF public.account
    LANGUAGE sql STABLE
    AS $$
  SELECT
    a.*
  FROM
    account as a
  WHERE
    a.name ILIKE CONCAT('%', input, '%') OR a.addr ILIKE CONCAT('%', input, '%');
$$;

CREATE OR REPLACE FUNCTION rename_get_current_party() RETURNS void AS $$
    DECLARE
    BEGIN
        BEGIN
           ALTER FUNCTION get_current_party() RENAME TO get_current_account; 
        EXCEPTION WHEN undefined_function THEN
        END;
    END;
$$ LANGUAGE plpgsql;

SELECT rename_get_current_party();
DROP FUNCTION IF EXISTS rename_get_current_party();
CREATE OR REPLACE FUNCTION public.get_current_account() RETURNS public.account
    LANGUAGE sql STABLE
    AS $$
  SELECT account.* from account where id=nullif(current_user,'')::uuid LIMIT 1;
$$;

DROP POLICY IF EXISTS party_update_only_by_creator ON public.account;
DROP POLICY IF EXISTS account_update_only_by_creator ON public.account;
CREATE POLICY account_update_only_by_creator ON public.account FOR UPDATE USING ((creator_id IN ( SELECT id FROM public.get_current_account())));

DROP POLICY IF EXISTS party_update_only_by_owner ON public.account;
DROP POLICY IF EXISTS account_update_only_by_owner ON public.account;
CREATE POLICY account_update_only_by_owner ON public.account FOR UPDATE USING ((id IN ( SELECT id FROM public.get_current_account())));

DROP POLICY IF EXISTS party_insert_all ON public.account;
DROP POLICY IF EXISTS account_insert_all ON public.account;
CREATE POLICY account_insert_all ON public.account FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS party_select_all ON public.account;
DROP POLICY IF EXISTS account_select_all ON public.account;
CREATE POLICY account_select_all ON public.account FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION temp_migration_helper() RETURNS void AS $$
    DECLARE
    BEGIN
        BEGIN
            ALTER TABLE project RENAME CONSTRAINT project_admin_party_id_fkey TO project_admin_account_id_fkey;
        EXCEPTION WHEN undefined_object THEN
        END;
        BEGIN
            ALTER TABLE project RENAME COLUMN admin_party_id TO admin_account_id;
        EXCEPTION WHEN undefined_column THEN
        END;
        BEGIN
            ALTER TABLE account RENAME CONSTRAINT party_creator_id_fkey TO account_creator_id_fkey;
        EXCEPTION WHEN undefined_object THEN
        END;
        BEGIN
            ALTER TABLE organization RENAME CONSTRAINT organization_party_id_fkey TO organization_account_id_fkey;
        EXCEPTION WHEN undefined_object THEN
        END;
        BEGIN
            ALTER TABLE organization RENAME COLUMN party_id TO account_id;
        EXCEPTION WHEN undefined_column THEN
        END;
        BEGIN
            ALTER INDEX party_pkey RENAME TO account_pkey;
        EXCEPTION WHEN undefined_table THEN
        END;
        BEGIN
            ALTER INDEX party_addr_key RENAME TO account_addr_key;
        EXCEPTION WHEN undefined_table THEN
        END;
        BEGIN
            ALTER INDEX party_creator_id_key RENAME TO account_creator_id_key;
        EXCEPTION WHEN undefined_table THEN
        END;
        BEGIN
            ALTER INDEX party_email_key RENAME TO account_email_key;
        EXCEPTION WHEN undefined_table THEN
        END;
        BEGIN
            ALTER TYPE party_type RENAME TO account_type;
        EXCEPTION WHEN undefined_object THEN
        END;
        BEGIN
            ALTER TABLE account RENAME CONSTRAINT party_type_check TO account_type_check;
        EXCEPTION WHEN undefined_object THEN
        END;
    END;
$$ LANGUAGE plpgsql;

SELECT temp_migration_helper();
DROP FUNCTION IF EXISTS temp_migration_helper();

DROP FUNCTION IF EXISTS private.create_new_account_with_wallet(text, public.party_type);
DROP FUNCTION IF EXISTS private.create_new_account_with_wallet(text, public.account_type);
CREATE FUNCTION private.create_new_account_with_wallet(addr text, v_account_type public.account_type) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_addr text = addr;
    v_account_id uuid;
BEGIN
    INSERT INTO account (TYPE, addr)
        VALUES (v_account_type, v_addr)
    ON CONFLICT ON CONSTRAINT
        account_addr_key
    DO UPDATE SET
        creator_id = null
    RETURNING
        id INTO v_account_id;

    RAISE LOG 'new party_id %', v_account_id;
    RETURN v_account_id;
END;
$$;

DROP POLICY IF EXISTS account_admin_with_addr_can_update_onchain_projects ON public.project;

CREATE POLICY account_admin_with_addr_can_update_onchain_projects ON public.project FOR
UPDATE TO auth_user USING (
  EXISTS (
    SELECT
      1
    FROM
      project
      JOIN account ON project.admin_account_id = account.id
    WHERE
      project.on_chain_id IS NOT NULL
      AND account.addr IS NOT NULL
      AND account = get_current_account ()
  )
);

DROP POLICY IF EXISTS account_admin_can_update_offchain_projects ON public.project;

CREATE POLICY account_admin_can_update_offchain_projects ON public.project FOR
UPDATE TO auth_user USING (
  EXISTS (
    SELECT
      1
    FROM
      project
      JOIN account ON project.admin_account_id = account.id
    WHERE
      project.on_chain_id IS NULL
      AND account = get_current_account ()
  )
);
