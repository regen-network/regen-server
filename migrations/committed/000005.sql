--! Previous: sha1:dc03ae9f3360755fc37988261bbc256265b289dd
--! Hash: sha1:2d4d2a03e17e6f1d5a40575b9c35f3429aa0464e

DROP FUNCTION IF EXISTS public.get_parties_by_name_or_addr;
CREATE OR REPLACE FUNCTION public.get_parties_by_name_or_addr (input text)
RETURNS SETOF party
AS $$
  SELECT
    p.*
  FROM
    party as p
  JOIN wallet ON wallet.id = p.wallet_id
  WHERE
    p.name ILIKE CONCAT('%', input, '%') OR wallet.addr ILIKE CONCAT('%', input, '%');
$$ LANGUAGE sql STABLE;
