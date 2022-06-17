CREATE OR REPLACE VIEW current_addrs AS (
    SELECT
        w.addr
    FROM (
        SELECT
            a.id
        FROM
            account a
            JOIN party p ON p.account_id = a.id
            JOIN wallet w ON p.wallet_id = w.id
        WHERE
            w.addr = CURRENT_USER) AS current_account
        JOIN party p ON p.account_id = current_account.id
        JOIN wallet w ON p.wallet_id = w.id);

DROP POLICY select_account_wallets ON wallet;

CREATE POLICY select_account_wallets ON wallet
    FOR SELECT TO app_user
        USING (addr IN (
            SELECT
                addr
            FROM
                current_addrs));

ALTER TABLE wallet ENABLE ROW LEVEL SECURITY;
