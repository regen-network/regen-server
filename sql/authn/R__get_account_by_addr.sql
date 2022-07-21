DROP FUNCTION IF EXISTS private.get_account_by_addr;
CREATE OR REPLACE FUNCTION private.get_account_by_addr (addr text)
    RETURNS TABLE (
        id uuid
    )
AS $$
DECLARE
    v_addr text = addr;
BEGIN
    RETURN query
    SELECT
        account.id
    FROM
        wallet
        JOIN party ON party.wallet_id = wallet.id
        JOIN account ON account.id = party.account_id
    WHERE
        wallet.addr = v_addr;
END;
$$
LANGUAGE plpgsql;
