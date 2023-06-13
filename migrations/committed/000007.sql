--! Previous: sha1:c43c9990313274cf38c307680c7dcc264fa0b16f
--! Hash: sha1:3a912c9309b338cf9e46579224207a7c7f072b29

DROP FUNCTION IF EXISTS public.get_parties_by_name_or_addr;
CREATE FUNCTION public.get_parties_by_name_or_addr(input text) RETURNS SETOF public.party
    LANGUAGE sql STABLE
    AS $$
  SELECT
    p.*
  FROM
    party as p
  LEFT JOIN wallet ON wallet.id = p.wallet_id
  WHERE
    p.name ILIKE CONCAT('%', input, '%') OR wallet.addr ILIKE CONCAT('%', input, '%');
$$;
