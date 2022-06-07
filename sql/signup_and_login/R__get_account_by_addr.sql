CREATE OR REPLACE FUNCTION get_account_by_addr (addr text, OUT account_id uuid)
AS $$
DECLARE
    _addr text = addr;
BEGIN
    SELECT
        account.id INTO account_id
    FROM
        wallet
        JOIN party ON party.wallet_id = wallet.id
        JOIN account ON account.id = party.account_id
    WHERE
        wallet.addr = _addr;
END;
$$
LANGUAGE plpgsql;
