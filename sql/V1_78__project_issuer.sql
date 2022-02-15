-- Renaming this to be more consistent with ledger data
-- https://github.com/regen-network/regen-registry/issues/788#issuecomment-1032851522
-- So far the only broker was RND which can be considered as the on-chain issuer
alter table project rename broker_id to issuer_id;