DROP FUNCTION IF EXISTS private.get_parties_by_account_id;
CREATE OR REPLACE FUNCTION private.get_parties_by_account_id (account_id uuid)
    RETURNS TABLE (
        id uuid
    )
    AS $$
DECLARE
    v_account_id uuid = account_id;
BEGIN
    RETURN query
    SELECT
        party.id
    FROM
        account
        JOIN party ON party.account_id = account.id
    WHERE
        account.id = v_account_id;
END;
$$
LANGUAGE plpgsql;
