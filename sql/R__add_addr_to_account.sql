CREATE OR REPLACE FUNCTION add_addr_to_account (account_id uuid, addr text)
    RETURNS void
    AS $$
DECLARE
    _account_id uuid = account_id;
    _addr text = addr;
    can_be_added boolean;
    _wallet_id uuid;
    _party_id uuid;
BEGIN
    can_be_added := public.addr_can_be_added (_account_id, _addr);
    IF can_be_added THEN
        INSERT INTO wallet (addr)
            VALUES (_addr)
        RETURNING
            id INTO _wallet_id;
        RAISE NOTICE '_wallet_id %', _wallet_id;
        INSERT INTO party (account_id, TYPE, name, wallet_id)
            VALUES (_account_id, 'user', 'Default Name', _wallet_id)
        RETURNING
            id INTO _party_id;
        RAISE NOTICE '_party_id %', _party_id;
    END IF;
END;
$$
LANGUAGE plpgsql;
