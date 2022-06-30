CREATE OR REPLACE FUNCTION get_current_account (OUT account_id uuid)
AS $$ 
DECLARE
    v_current_user name;
BEGIN
    SELECT * INTO v_current_user FROM current_user;
    RAISE LOG '%', v_current_user;
    SELECT
        account.id INTO account_id
    FROM
        wallet
        JOIN party ON party.wallet_id = wallet.id
        JOIN account ON account.id = party.account_id
    WHERE
        wallet.addr = v_current_user;
END;
$$
LANGUAGE plpgsql;
