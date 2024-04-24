--! Previous: sha1:6fb2a57712fc951037b94bd14914d232ac24da12
--! Hash: sha1:fd9c0b6eecc2142dce19df696187ebce98fca01e

ALTER TABLE IF EXISTS upload
DROP CONSTRAINT IF EXISTS upload_pkey,
ADD COLUMN IF NOT EXISTS id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
ADD CONSTRAINT upload_pkey PRIMARY KEY(id);
