DROP FUNCTION IF EXISTS addr_can_be_added(uuid, text);
CREATE OR REPLACE FUNCTION addr_can_be_added (account_id uuid, addr text, OUT can_be_added boolean)
AS $$
DECLARE
    v_account_id uuid = account_id;
    v_addr text = addr;
    associated_account_id uuid;
BEGIN
    PERFORM
        id
    FROM
        account
    WHERE
        id = v_account_id;
    IF NOT found THEN
        RAISE EXCEPTION
            USING message = 'no account found for given account_id', hint = 'check the account_id', errcode = 'NTFND';
    END IF;
    associated_account_id := private.get_account_by_addr (v_addr);
    IF associated_account_id IS NULL THEN
        can_be_added := true;
    ELSE
        IF associated_account_id = account_id THEN
            RAISE EXCEPTION 'this addr already belongs to this account';
        ELSE
            RAISE EXCEPTION 'this addr belongs to a different user';
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS addr_can_be_added(text);
CREATE OR REPLACE FUNCTION addr_can_be_added (addr text, OUT can_be_added boolean)
AS $$
DECLARE
    v_addr text = addr;
    associated_account_id uuid;
BEGIN
    associated_account_id := private.get_account_by_addr (addr);
    IF associated_account_id IS NULL THEN
        can_be_added := true;
    ELSE
        RAISE EXCEPTION 'this addr belongs to a user';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
