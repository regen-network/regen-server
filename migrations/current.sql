DROP FUNCTION IF EXISTS private.create_new_account_with_wallet;
CREATE FUNCTION private.create_new_account_with_wallet(addr text, v_account_type public.account_type) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_addr text = addr;
  v_account_id uuid;
BEGIN    
  INSERT INTO account (TYPE, addr)
    VALUES (v_account_type, v_addr)
  ON CONFLICT ON CONSTRAINT
    account_addr_key
  DO UPDATE SET
    creator_id = null
  RETURNING id INTO v_account_id;

  INSERT INTO private.account (id)
    VALUES (v_account_id)
  ON CONFLICT ON CONSTRAINT
    account_pkey
  DO NOTHING;

  RAISE LOG 'new account_id %', v_account_id;
  RETURN v_account_id;
END;
$$;