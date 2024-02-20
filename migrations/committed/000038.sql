--! Previous: sha1:61e1ba27be33be6958c143488c970ef82707b159
--! Hash: sha1:91560c4e038e79b7b7b8bc48328ef76c9a325c6d

DROP TABLE IF EXISTS private.account;
CREATE TABLE private.account (
  id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
  email public.citext UNIQUE,
  google text UNIQUE
);
COMMENT ON TABLE private.account IS 'Table to store private account fields like email or google id';

-- Migrate email and google over to private.account
INSERT INTO private.account (id, email, google)
SELECT id, email, google from public.account
ON CONFLICT DO NOTHING;

DROP FUNCTION IF EXISTS private.create_new_web2_account;
CREATE FUNCTION private.create_new_web2_account(v_account_type public.account_type, v_email public.citext default null, v_google text default null) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_account_id uuid;
BEGIN
    INSERT INTO private.account (email, google)
      VALUES (v_email, v_google)
      RETURNING id INTO v_account_id;
    INSERT INTO public.account (id, type)
      VALUES (v_account_id, v_account_type);
    
    RAISE LOG 'new account_id %', v_account_id;
    RETURN v_account_id;
END;
$$;
COMMENT ON FUNCTION private.create_new_web2_account IS 'Insert a new account with email or google id in both private.account and public.account tables';
