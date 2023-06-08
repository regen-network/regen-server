--! Previous: sha1:2d4d2a03e17e6f1d5a40575b9c35f3429aa0464e
--! Hash: sha1:c43c9990313274cf38c307680c7dcc264fa0b16f

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

DROP FUNCTION IF EXISTS private.add_addr_to_account;
CREATE OR REPLACE FUNCTION private.add_addr_to_account (account_id uuid, addr text, v_party_type party_type)
    RETURNS void
    AS $$
DECLARE
    v_account_id uuid = account_id;
    v_addr text = addr;
    can_be_added boolean;
    v_wallet_id uuid;
    v_party_id uuid;
    v_current_user name;
BEGIN
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

        SELECT
            party.id INTO v_party_id
        FROM
            party
        JOIN
            wallet
        ON
            wallet.id = party.wallet_id
        WHERE
            wallet.addr = v_addr;
        RAISE LOG 'v_party_id %', v_party_id;

        IF v_party_id is null THEN
          RAISE LOG 'creating new party...';
          SELECT * INTO v_party_id from uuid_generate_v1();
          INSERT INTO party (id, account_id, TYPE, wallet_id)
               VALUES (v_party_id, v_account_id, v_party_type, v_wallet_id);
          RAISE LOG 'new _party_id %', v_party_id;
        ELSE
          RAISE LOG 'associating preexisting party...';
          UPDATE party SET account_id = v_account_id WHERE id = v_party_id ;
        END IF;
    END IF;
END;
$$
LANGUAGE plpgsql;
