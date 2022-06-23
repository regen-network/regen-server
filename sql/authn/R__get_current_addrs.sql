CREATE OR REPLACE FUNCTION get_current_addrs ()
    RETURNS TABLE (
        addr text
    )
    AS $$ 
DECLARE
    v_account_id uuid;
BEGIN
    SELECT * INTO v_account_id FROM get_current_account();
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
