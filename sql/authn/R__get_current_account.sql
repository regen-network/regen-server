CREATE OR REPLACE FUNCTION get_current_account (OUT account_id uuid)
AS $$ 
DECLARE
BEGIN
    SELECT * INTO account_id FROM get_current_account_id();
END;
$$
LANGUAGE plpgsql STABLE;
