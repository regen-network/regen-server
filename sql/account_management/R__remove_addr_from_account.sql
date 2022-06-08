CREATE OR REPLACE FUNCTION remove_addr_from_account (v_account_id uuid, v_addr text)
    RETURNS VOID 
    AS $$
DECLARE
    v_num_addrs bigint;
	v_removed int;
BEGIN
    SELECT
        count(q.addr) INTO v_num_addrs
    FROM
        public.get_addrs_by_account_id (v_account_id) q
    WHERE
        q.addr = v_addr;

    IF v_num_addrs = 0 THEN
        RAISE 'cannot remove, this address does not belong to user';
    END IF;

    WITH removal_confirm as (DELETE FROM party p USING (
        SELECT
            p.id AS pid
        FROM
            party p
            JOIN wallet w ON p.wallet_id = w.id
        WHERE
            w.addr = v_addr) party_removal
    WHERE
        p.id = party_removal.pid
    RETURNING 1)
    SELECT count(*) INTO v_removed FROM removal_confirm;

    IF v_removed = 1 THEN
        raise notice 'party association has been removed';
    END IF;
END;
$$
LANGUAGE plpgsql;
