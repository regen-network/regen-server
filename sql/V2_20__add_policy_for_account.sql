CREATE OR REPLACE VIEW current_account AS (
    SELECT
        a.id
    FROM
        wallet w
        JOIN party p ON p.wallet_id = w.id
        JOIN account a ON a.id = p.account_id
    WHERE
        w.addr = CURRENT_USER);

GRANT SELECT ON current_account TO auth_user;

DROP POLICY IF EXISTS user_can_only_select_their_account ON account;

CREATE POLICY user_can_only_select_their_account ON account
    FOR SELECT
        USING (id IN (
            SELECT
                id
            FROM
                current_account));
