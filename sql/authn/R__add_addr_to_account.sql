CREATE OR REPLACE FUNCTION add_addr_to_account (addr text)
    RETURNS void
    AS $$
DECLARE
    v_account_id uuid;
    v_addr text = addr;
    can_be_added boolean;
    v_wallet_id uuid;
    v_party_id uuid;
    v_current_user name;
BEGIN
    SELECT * INTO v_account_id FROM get_current_account();
    RAISE NOTICE 'v_account_id %', v_account_id;
    can_be_added := public.addr_can_be_added (v_account_id, v_addr);
    IF can_be_added THEN
        INSERT INTO wallet (addr)
            VALUES (v_addr)
        ON CONFLICT ON CONSTRAINT wallet_addr_key DO UPDATE SET
            addr = v_addr
        RETURNING
            id INTO v_wallet_id;
        RAISE NOTICE '_wallet_id %', v_wallet_id;
        -- TODO: parametrize 'user'
        INSERT INTO party (account_id, TYPE, name, wallet_id)
            VALUES (v_account_id, 'user', 'Default Name', v_wallet_id)
        RETURNING
            id INTO v_party_id;
        RAISE NOTICE '_party_id %', v_party_id;
    END IF;
END;
$$
LANGUAGE plpgsql;
