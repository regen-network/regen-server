--! Previous: sha1:3dd6808797e38b3d56a481872c81292adca3d190
--! Hash: sha1:7bcdb97db96133598707230a843d51c3c94d3cf8

DROP FUNCTION IF EXISTS private.shuffle CASCADE;
CREATE OR REPLACE FUNCTION private.shuffle(text)
RETURNS TEXT LANGUAGE SQL AS $$
  SELECT string_agg(ch, '')
  FROM (
      SELECT substr($1, i, 1) ch
      FROM generate_series(1, length($1)) i
      ORDER BY random()
      ) s
$$;
COMMENT ON FUNCTION private.shuffle(text) IS 'Shuffles an incoming string and aggregates the resulting rows to a string';

DROP FUNCTION IF EXISTS private.random_passcode CASCADE;
CREATE OR REPLACE FUNCTION private.random_passcode() 
RETURNS char(6) LANGUAGE SQL AS $$
  SELECT string_agg(private.shuffle('0123456789')::char, '')
  FROM generate_series(1, 6)
$$;
COMMENT ON FUNCTION private.random_passcode() IS 'Generates a 6 digits random code';


CREATE TABLE IF NOT EXISTS private.passcode (
  id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  email CITEXT NOT NULL,
  consumed boolean DEFAULT 'f' NOT NULL,
  code char(6) DEFAULT private.random_passcode() NOT NULL,
  max_try_count smallint DEFAULT 0 NOT NULL
);
COMMENT ON TABLE private.passcode IS 'Passcodes for signing in with email';
