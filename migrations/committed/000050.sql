--! Previous: sha1:03904343f3fa27b1a1531a7b465a4b36583f491b
--! Hash: sha1:6fb2a57712fc951037b94bd14914d232ac24da12

ALTER TABLE IF EXISTS account
ADD COLUMN IF NOT EXISTS hide_ecocredits boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS hide_retirements boolean DEFAULT false;
