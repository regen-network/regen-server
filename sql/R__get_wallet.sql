create or replace function get_wallet_by_address(wallet_address text) returns setof wallet as $$
  select * from wallet where addr = wallet_address;
$$ language sql stable;