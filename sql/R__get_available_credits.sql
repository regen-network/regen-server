create or replace function get_available_credits
(
  vintage_id uuid
) returns numeric as $$
declare
  v_available_credits numeric;
begin
  select available_credits
  from get_available_credits_record(vintage_id)
  into
    v_available_credits
  as
  (
    available_credits numeric,
    initial_distribution jsonb,
    credit_class_id uuid,
    developer_id uuid,
    land_owner_id uuid,
    steward_id uuid,
    developer_wallet_id uuid,
    land_owner_wallet_id uuid,
    steward_wallet_id uuid,
    project jsonb,
    reseller_id uuid
  );
  return v_available_credits;
end;
$$ language plpgsql STABLE
set search_path
= pg_catalog, public, pg_temp;

create or replace function get_available_credits_record
(
  vintage_id uuid
) returns RECORD as $$
declare
  result_record RECORD;
  v_credit_vintage credit_vintage;
  v_project project;
  v_developer_wallet_id uuid;
  v_land_owner_wallet_id uuid;
  v_steward_wallet_id uuid;
  v_available_credits numeric;
  v_project_location address;
begin
  -- get credit vintage
  select *
  into v_credit_vintage
  from credit_vintage
  where id = vintage_id;

  if v_credit_vintage.id is null then
    raise exception 'Credit vintage not found' using errcode = 'NTFND';
end
if;

  -- get project
  select *
into v_project
from project
where id = v_credit_vintage.project_id;

if v_project.id is null then
    raise exception 'Project not found' using errcode = 'NTFND';
end
if;

  -- get wallet ids of project's stakeholders
  select wallet_id
from party
into v_developer_wallet_id where id = v_project.developer_id;
select wallet_id
from party
into v_land_owner_wallet_id where id = v_project.land_owner_id;
select wallet_id
from party
into v_steward_wallet_id where id = v_project.steward_id;

select sum(liquid_balance)
into v_available_credits
from account_balance
where (wallet_id = v_developer_wallet_id or wallet_id = v_land_owner_wallet_id or wallet_id = v_steward_wallet_id)
  and credit_vintage_id = vintage_id;

-- project location
select *
from address
into v_project_location
  where id = v_project.address_id;

select
  v_available_credits,
  v_credit_vintage.initial_distribution,
  v_credit_vintage.credit_class_id,
  v_project.developer_id, v_project.land_owner_id, v_project.steward_id,
  v_developer_wallet_id, v_land_owner_wallet_id, v_steward_wallet_id,
  jsonb_build_object(
        'metadata', v_project.metadata
      ),
  v_credit_vintage.reseller_id
into result_record;

return result_record;
end;
$$ language plpgsql volatile
set search_path
= pg_catalog, public, pg_temp;
