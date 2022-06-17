CREATE OR REPLACE FUNCTION create_new_account (addr text, v_party_type party_type)
    RETURNS uuid
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
        RAISE NOTICE 'trying to create new account for this addr';

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
        RETURNING
            id INTO v_party_id;

        RAISE NOTICE 'new account_id %', v_account_id;
        RAISE NOTICE 'new party_id %', v_party_id;
        RAISE NOTICE 'new wallet_id %', v_wallet_id;
	RETURN v_account_id;
    END IF;
END;
$$
LANGUAGE plpgsql SECURITY DEFINER;
