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

GRANT SELECT ON current_addrs TO app_user;

DROP POLICY IF EXISTS select_account_wallets ON wallet;

CREATE POLICY select_account_wallets ON wallet
    FOR SELECT TO app_user
        USING (addr IN (
            SELECT
                addr
            FROM
                current_addrs));

ALTER TABLE wallet ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW current_account AS (
    SELECT
        a.id
    FROM
        account a
        JOIN party p ON p.account_id = a.id
        JOIN wallet w ON p.wallet_id = w.id
    WHERE
        w.addr = CURRENT_USER
);

GRANT SELECT ON current_account TO app_user;

DROP POLICY IF EXISTS select_accounts ON account;
CREATE POLICY select_accounts ON account
    FOR SELECT TO app_user
        USING (id IN (
            SELECT
                id
            FROM
                current_account));
DROP POLICY IF EXISTS delete_accounts ON account;
CREATE POLICY delete_accounts ON account
    FOR DELETE TO app_user
        USING (id IN (
            SELECT
                id
            FROM
                current_account));

ALTER TABLE account ENABLE ROW LEVEL SECURITY;
