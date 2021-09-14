drop function if exists retire_credits;
create or replace function retire_credits(
  vintage_id uuid,
  buyer_wallet_id uuid,
  address_id uuid,
  units numeric,
  metadata jsonb default '{}'
) returns retirement as $$
declare
  v_retirement retirement;
begin
  -- Update buyer account balance
  update account_balance
  set liquid_balance = liquid_balance - units, burnt_balance = burnt_balance + units
  where credit_vintage_id = vintage_id and wallet_id = buyer_wallet_id;

  -- Create new entry in retirement table
  insert into retirement
    (wallet_id, address_id, credit_vintage_id, units, metadata)
  values
    (buyer_wallet_id, address_id, vintage_id, units, metadata)
  returning * into v_retirement;

  return v_retirement;
end;
$$ language plpgsql strict volatile
set search_path
to pg_catalog, public, pg_temp;