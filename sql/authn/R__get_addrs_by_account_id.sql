CREATE OR REPLACE FUNCTION get_addrs_by_account_id (account_id uuid)
    RETURNS TABLE (
        addr text
    )
    AS $$
DECLARE
    v_account_id uuid = account_id;
BEGIN
    RETURN query
    SELECT
        wallet.addr
    FROM
        account
        JOIN party ON party.account_id = account.id
        JOIN wallet ON party.wallet_id = wallet.id
    WHERE
        account.id = v_account_id;
END;
$$
LANGUAGE plpgsql;
