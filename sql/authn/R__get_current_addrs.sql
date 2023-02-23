DROP FUNCTION IF EXISTS get_current_addrs;
CREATE OR REPLACE FUNCTION get_current_addrs ()
    RETURNS TABLE (
        wallet_id uuid,
        addr text,
        profile_type party_type
    )
    AS $$ 
DECLARE
    v_account_id uuid;
BEGIN
    SELECT * INTO v_account_id FROM get_current_account();
    RETURN query
    SELECT
        wallet.id, wallet.addr, party.type
    FROM
        account
        JOIN party ON party.account_id = account.id
        JOIN wallet ON party.wallet_id = wallet.id
    WHERE
        account.id = v_account_id;
END;
$$
LANGUAGE plpgsql STABLE;
