CREATE OR REPLACE FUNCTION update_profile (account_id uuid, addr text, party_type party_type, name text, image text)
    RETURNS void
    as $$
DECLARE
    v_account_id uuid = account_id;
    v_addr text = addr;
    v_party_type party_type = party_type;
    v_name text = name;
    v_image text = image;
BEGIN
    -- check that the given address is indeed associated to the given account_id
    -- this is important because we only want to allow the owner of an account to
    -- be able to modify their party/profile info.
    PERFORM FROM get_addrs_by_account_id(v_account_id) t WHERE t.addr = v_addr;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING message = 'the given address does not belong to the given account';
    ELSE
      -- if the given address belongs to the given account, we now lookup the
      -- party associated to the address. this query only returns one party
      -- because of 1-1 association between party and wallet.
      WITH pids AS (
        SELECT p.id as pid FROM wallet w JOIN party p ON p.wallet_id = w.id WHERE w.addr = v_addr
      )
      UPDATE
        party
      SET
        type = v_party_type,
        name = v_name,
        image = v_image,
        updated_at = now()
      WHERE
        id in (select pid from pids);
    END IF;
END;
$$
LANGUAGE plpgsql;
