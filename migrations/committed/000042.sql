--! Previous: sha1:ad13d579cf6ed4c7a4a12fb9ce5e18d930cec551
--! Hash: sha1:40d3ac2d637042a763de8cb291ebf797bfa651c3

ALTER TABLE private.account
DROP CONSTRAINT IF EXISTS public_account_id_fkey;

ALTER TABLE private.account
ADD CONSTRAINT public_account_id_fkey FOREIGN KEY (id) REFERENCES public.account(id);

DROP FUNCTION IF EXISTS private.create_new_web2_account;
-- Updating this function to first create the public.account, then the private.account
-- in order to satisfy the public_account_id_fkey constraint from above
CREATE FUNCTION private.create_new_web2_account(v_account_type public.account_type, v_email public.citext default null, v_google text default null) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_account_id uuid;
BEGIN
    INSERT INTO public.account (type)
      VALUES (v_account_type)
      RETURNING id INTO v_account_id;
    
    INSERT INTO private.account (id, email, google)
      VALUES (v_account_id, v_email, v_google);
    
    RAISE LOG 'new account_id %', v_account_id;
    RETURN v_account_id;
END;
$$;
COMMENT ON FUNCTION private.create_new_web2_account IS 'Insert a new account with email or google id in both private.account and public.account tables';
