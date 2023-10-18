--! Previous: sha1:55954f28989762683574dda00d7f1a1a2788dc71
--! Hash: sha1:893e894de354333f712a5275011cfb294c1e38fa

-- Enter migration here
ALTER TABLE party
DROP CONSTRAINT IF EXISTS party_addr_key;

ALTER TABLE party ADD CONSTRAINT party_addr_key UNIQUE (addr);
