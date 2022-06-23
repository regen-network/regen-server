DROP POLICY IF EXISTS party_insert_all ON party;
CREATE POLICY party_insert_all ON party
    FOR INSERT
        WITH CHECK (TRUE);

DROP POLICY IF EXISTS party_select_all ON party;
CREATE POLICY party_select_all ON party
    FOR SELECT
        USING (TRUE);

DROP POLICY IF EXISTS party_update_only_by_owner ON party;
CREATE POLICY party_update_only_by_owner ON party
    FOR UPDATE
        USING (id IN (
            SELECT
                p.id
            FROM
                party p
            WHERE
                p.account_id IN (
                    SELECT
                        account_id
                    FROM
                        get_current_account ())))
