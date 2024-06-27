DROP TABLE IF EXISTS private.post_token;

CREATE TABLE private.post_token (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v1() NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  post_iri text NOT NULL,
  token bytea DEFAULT gen_random_bytes(16) NOT NULL,
  CONSTRAINT fk_post_iri
    FOREIGN KEY(post_iri) 
	  REFERENCES post(iri)
);

COMMENT ON TABLE private.post_token IS 'Table with cryptographically strong random tokens to share data post link';

ALTER TABLE IF EXISTS s3_deletion
DROP CONSTRAINT IF EXISTS s3_deletion_pkey,
ADD COLUMN IF NOT EXISTS id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
ADD CONSTRAINT s3_deletion_pkey PRIMARY KEY(id);
