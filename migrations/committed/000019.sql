--! Previous: sha1:ce3204a9d9c8a36c037c5f8f1283d61e4d0b103e
--! Hash: sha1:09d1f97119d30a2788e70643906a169bc1774161

-- Enter migration here
DROP POLICY IF EXISTS project_update_policy ON public.project;

CREATE POLICY project_update_policy ON public.project FOR
UPDATE TO auth_user USING (true)
WITH
  CHECK (true);

DROP FUNCTION IF EXISTS private.get_account_by_addr (text);

DROP FUNCTION IF EXISTS private.get_addrs_by_account_id (uuid);

DROP FUNCTION IF EXISTS private.add_addr_to_account (uuid, text, public.party_type);

DROP FUNCTION IF EXISTS public.addr_can_be_added (text);

DROP FUNCTION IF EXISTS public.addr_can_be_added (uuid, text);

DROP FUNCTION IF EXISTS public.get_current_addrs ();

DROP FUNCTION IF EXISTS private.get_parties_by_account_id (uuid);

DROP FUNCTION IF EXISTS private.remove_addr_from_account (uuid, text);

DROP FUNCTION IF EXISTS public.get_current_account ();

DROP FUNCTION IF EXISTS public.get_current_account_id ();

DROP FUNCTION IF EXISTS private.create_new_account(addr text, v_party_type public.party_type);

DROP FUNCTION IF EXISTS private.create_new_account_with_wallet(addr text, v_party_type public.party_type);

CREATE FUNCTION private.create_new_account_with_wallet(addr text, v_party_type public.party_type) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_addr text = addr;
    v_wallet_id uuid;
    v_party_id uuid;
BEGIN
    INSERT INTO wallet (addr)
        VALUES (v_addr)
    ON CONFLICT ON CONSTRAINT
        wallet_addr_key
    DO UPDATE SET
        addr = v_addr
    RETURNING
        id INTO v_wallet_id;

    INSERT INTO party (TYPE, wallet_id)
        VALUES (v_party_type, v_wallet_id)
    ON CONFLICT ON CONSTRAINT
        party_wallet_id_key
    DO UPDATE SET
        creator_id = null
    RETURNING
        id INTO v_party_id;

    RAISE LOG 'new party_id %', v_party_id;
    RAISE LOG 'new wallet_id %', v_wallet_id;
    RETURN v_party_id;
END;
$$;
