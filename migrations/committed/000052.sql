--! Previous: sha1:fd9c0b6eecc2142dce19df696187ebce98fca01e
--! Hash: sha1:f06415147ef75ea457adb790772bc4ee6b85b97a

DROP TABLE IF EXISTS s3_deletion;

CREATE TABLE s3_deletion (
  id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  bucket text NOT NULL,
  key text NOT NULL
);

COMMENT ON TABLE s3_deletion IS 'Table serving as a FIFO queue for files to be deleted from AWS S3.'
