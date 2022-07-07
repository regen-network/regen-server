DROP FUNCTION IF EXISTS add_addr_to_account;
CREATE OR REPLACE FUNCTION add_addr_to_account (addr text, v_party_type party_type)
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
    RAISE LOG 'v_account_id %', v_account_id;
    can_be_added := public.addr_can_be_added (v_account_id, v_addr);
    IF can_be_added THEN
        INSERT INTO wallet (addr)
            VALUES (v_addr)
        ON CONFLICT ON CONSTRAINT wallet_addr_key DO UPDATE SET
            addr = v_addr
        RETURNING
            id INTO v_wallet_id;
        RAISE LOG '_wallet_id %', v_wallet_id;
        SELECT * INTO v_party_id from uuid_generate_v1();
        INSERT INTO party (id, account_id, TYPE, wallet_id)
            VALUES (v_party_id, v_account_id, v_party_type, v_wallet_id);
        RAISE LOG '_party_id %', v_party_id;
    END IF;
END;
$$
LANGUAGE plpgsql;
