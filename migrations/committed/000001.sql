--! Previous: -
--! Hash: sha1:854455b4dfefc488a97a9c54cd783ad2b4696192

-- Enter migration here
DROP FUNCTION IF EXISTS private.remove_addr_from_account;
CREATE OR REPLACE FUNCTION private.remove_addr_from_account (v_account_id uuid, v_addr text)
    RETURNS VOID
    AS $$
DECLARE
    v_num_addrs bigint;
	v_removed int;
BEGIN
    --- figure out if the given address belongs to the given account
    SELECT
        count(q.addr) INTO v_num_addrs
    FROM
        private.get_addrs_by_account_id (v_account_id) q
    WHERE
        q.addr = v_addr;

    --- if the given address does not belong to the given account
    --- throw an error because you cannot remove the address from this account
    IF v_num_addrs = 0 THEN
        RAISE 'cannot remove, this address is not associated to the given account id';
    END IF;

    WITH update_confirm AS (
      UPDATE
        party p
      SET
        account_id = null
      WHERE
        p.id in (
          SELECT
            p.id AS pid
          FROM
            party p
            JOIN wallet w on p.wallet_id = w.id
          WHERE
            w.addr = v_addr
        ) RETURNING 1
    )
    SELECT
      count(*) INTO v_removed
    FROM
      update_confirm;

    IF v_removed = 1 THEN
        raise notice 'party association has been removed';
    ELSE
        raise 'error removing the address';
    END IF;
END;
$$
LANGUAGE plpgsql;

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
          UPDATE party SET account_id = v_account_id, type = v_party_type WHERE id = v_party_id ;
        END IF;
    END IF;
END;
$$
LANGUAGE plpgsql;
