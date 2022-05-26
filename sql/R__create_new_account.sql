CREATE OR REPLACE FUNCTION create_new_account (addr text)
    RETURNS void
    AS $$
DECLARE
    _addr text = addr;
    can_be_added boolean;
    _account_id uuid;
    _wallet_id uuid;
    _party_id uuid;
BEGIN
    can_be_added := addr_can_be_added (_addr);
    IF can_be_added THEN
        RAISE NOTICE 'trying to create new account for this addr';

        INSERT INTO account DEFAULT
            VALUES
            RETURNING
                id INTO _account_id;

        INSERT INTO wallet (addr)
            VALUES (_addr)
        RETURNING
            id INTO _wallet_id;

        INSERT INTO party (account_id, TYPE, name, wallet_id)
            VALUES (_account_id, 'user', 'Default Name', _wallet_id)
        RETURNING
            id INTO _party_id;

        RAISE NOTICE 'new account_id %', _account_id;
        RAISE NOTICE 'new party_id %', _party_id;
        RAISE NOTICE 'new wallet_id %', _wallet_id;
    END IF;
END;
$$
LANGUAGE plpgsql;
