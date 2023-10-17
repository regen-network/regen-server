DROP FUNCTION IF EXISTS private.shuffle;
CREATE OR REPLACE FUNCTION private.shuffle(text)
RETURNS TEXT LANGUAGE SQL AS $$
  SELECT string_agg(ch, '')
  FROM (
      SELECT substr($1, i, 1) ch
      FROM generate_series(1, length($1)) i
      ORDER BY random()
      ) s
$$;

DROP FUNCTION IF EXISTS private.random_passcode;
CREATE OR REPLACE FUNCTION private.random_passcode() 
RETURNS char(6) LANGUAGE SQL AS $$
  SELECT string_agg(private.shuffle('0123456789')::char, '')
  FROM generate_series(1, 6)
$$;

CREATE TABLE IF NOT EXISTS private.passcode (
  id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  email CITEXT NOT NULL,
  consumed boolean DEFAULT 'f' NOT NULL,
  code char(6) DEFAULT private.random_passcode() NOT NULL
);

