--! Previous: sha1:3b42ef8f9ef3c4bee383f705fb6b54653c05e9df
--! Hash: sha1:a38c8e478d6d4efa0a0c01805cd4030c059f241a

DROP FUNCTION IF EXISTS private.create_new_web2_account;

CREATE FUNCTION private.create_new_web2_account(v_account_type public.account_type, v_email public.citext DEFAULT NULL::public.citext, v_google text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_account_id uuid;
BEGIN
    INSERT INTO public.account (type)
      VALUES (v_account_type)
      RETURNING id INTO v_account_id;
    
    INSERT INTO private.account (id, email, google, google_email)
      VALUES (v_account_id, v_email, v_google, case when v_google is not null then v_email else null end);
    
    RAISE LOG 'new account_id %', v_account_id;
    RETURN v_account_id;
END;
$$;
