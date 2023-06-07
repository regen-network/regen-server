DROP POLICY IF EXISTS wallet_insert_policy on public.wallet;
CREATE POLICY wallet_insert_policy ON public.wallet FOR INSERT TO auth_user WITH CHECK (true);

DROP FUNCTION IF EXISTS private.create_new_account;
CREATE FUNCTION private.create_new_account(addr text, v_party_type public.party_type) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_addr text = addr;
    can_be_added boolean;
    v_account_id uuid;
    v_wallet_id uuid;
    v_party_id uuid;
BEGIN
    can_be_added := public.addr_can_be_added (v_addr);
    IF can_be_added THEN
        RAISE LOG 'trying to create new account for this addr';

        INSERT INTO account DEFAULT
            VALUES
            RETURNING
                id INTO v_account_id;

        INSERT INTO wallet (addr)
            VALUES (v_addr)
        ON CONFLICT ON CONSTRAINT
            wallet_addr_key
        DO UPDATE SET
            addr = v_addr
        RETURNING
            id INTO v_wallet_id;

        INSERT INTO party (account_id, TYPE, wallet_id)
            VALUES (v_account_id, v_party_type, v_wallet_id)
        ON CONFLICT ON CONSTRAINT
            party_wallet_id_key
        DO UPDATE SET
            account_id = v_account_id
        RETURNING
            id INTO v_party_id;

        RAISE LOG 'new account_id %', v_account_id;
        RAISE LOG 'new party_id %', v_party_id;
        RAISE LOG 'new wallet_id %', v_wallet_id;
	RETURN v_account_id;
    END IF;
END;
$$;