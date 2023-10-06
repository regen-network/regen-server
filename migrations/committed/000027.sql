--! Previous: sha1:893e894de354333f712a5275011cfb294c1e38fa
--! Hash: sha1:69ddd1280966478d7ad948c919acc2624e8c2920

-- Enter migration here
DROP FUNCTION IF EXISTS get_parties_by_name_or_addr(text);

CREATE FUNCTION public.get_parties_by_name_or_addr(input text) RETURNS SETOF public.party
    LANGUAGE sql STABLE
    AS $$
  SELECT
    p.*
  FROM
    party as p
  WHERE
    p.name ILIKE CONCAT('%', input, '%') OR p.addr ILIKE CONCAT('%', input, '%');
$$;
