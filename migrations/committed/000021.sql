--! Previous: sha1:1104b194ab8b88772c510db5d88bc719a9e93f8c
--! Hash: sha1:0b254fb5914e2d94fd9c3b979dc240b547ddc702

-- Enter migration here
ALTER TABLE party
ADD COLUMN IF NOT EXISTS addr text;

UPDATE party
SET
  addr = t.addr
FROM
  (
    select
      wallet.id as wid,
      party.id as pid,
      wallet.addr
    from
      wallet
      join party on party.wallet_id = wallet.id
    where
      wallet.addr like 'regen%'
  ) t
WHERE
  party.id = t.pid;
