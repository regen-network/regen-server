--! Previous: sha1:69ddd1280966478d7ad948c919acc2624e8c2920
--! Hash: sha1:279043272f4796772f4ea1b87bd9a53ef5cd6926

-- Enter migration here
DROP FUNCTION IF EXISTS private.create_new_account_with_wallet (text, public.party_type);

CREATE FUNCTION private.create_new_account_with_wallet(addr text, v_party_type public.party_type) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_addr text = addr;
    v_party_id uuid;
BEGIN
    INSERT INTO party (TYPE, addr)
        VALUES (v_party_type, v_addr)
    ON CONFLICT ON CONSTRAINT
        party_addr_key
    DO UPDATE SET
        creator_id = null
    RETURNING
        id INTO v_party_id;

    RAISE LOG 'new party_id %', v_party_id;
    RETURN v_party_id;
END;
$$;
