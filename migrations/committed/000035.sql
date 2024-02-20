--! Previous: sha1:ef23be0e0e045be92fd69c1796ce5d906c769a8a
--! Hash: sha1:e85c0080463f82d21455b8390edb43ef995f43dc

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

    RAISE LOG 'new account_id %', v_account_id;
    RETURN v_account_id;
END;
$$;
