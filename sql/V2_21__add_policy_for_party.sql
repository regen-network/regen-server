CREATE OR REPLACE VIEW current_parties AS (
    SELECT
        p.id
    FROM
        current_account ca
        JOIN party p ON p.account_id = ca.id
        JOIN wallet w ON p.wallet_id = w.id);

GRANT SELECT ON current_parties TO auth_user;

DROP POLICY IF EXISTS party_select_all ON party;
DROP POLICY IF EXISTS user_can_only_select_their_parties ON party;

CREATE POLICY user_can_only_select_their_parties ON party
    FOR SELECT
        USING (id IN (
            SELECT
                id
            FROM
                current_parties));
