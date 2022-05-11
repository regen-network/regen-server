create or replace function get_user_first_organization(
  user_id uuid
) returns organization as $$
declare
  v_organization organization;
begin
  select organization.*
  into v_organization
  from organization
  inner join organization_member on organization_member.organization_id = organization.id
  where organization_member.member_id = user_id
  limit 1;

  return v_organization;
end;
$$ language plpgsql strict volatile
set search_path
to pg_catalog, public, pg_temp;

drop function if exists get_wallet_id;
create or replace function get_wallet_id(
  party_id uuid
) returns uuid as $$
declare
  wallet_id uuid;
  _party_id uuid = party_id;
begin
  SELECT
      w.id
  FROM
      party AS p
  INTO
      wallet_id
  LEFT JOIN wallet AS w ON
      p.id = w.party_id
  WHERE
      p.id = _party_id
  ORDER BY
      w.created_at ASC
  LIMIT 1;
  RETURN wallet_id;
end;
$$ language plpgsql;

drop function if exists issue_credits;
create or replace function issue_credits(
  project_id uuid,
  credit_class_version_id uuid,
  credit_class_version_created_at timestamptz,
  methodology_version_id uuid,
  methodology_version_created_at timestamptz,
  units integer,
  initial_distribution jsonb,
  start_date timestamptz,
  end_date timestamptz,
  metadata jsonb default '{}',
  initial_issuer_id uuid default uuid_nil(), -- optional party id of the initial issuer in case of 3rd party credits
  reseller_id uuid default uuid_nil(), -- optional wallet id of the reseller, credits gets issued to the reseller in case of 3rd party credits
  batch_denom text default null
) returns jsonb as $$
declare
  v_tokenizer "user";
  v_tokenizer_organization organization;
  v_tokenizer_wallet_id uuid;
  v_credit_class_issuer_id uuid;
  v_issuee_id uuid;
  v_credit_vintage credit_vintage;
  v_party party;
  v_project project;
  v_key text;
  v_value numeric;
  v_sum numeric;
  v_deduction numeric default 1;
  v_account_balances jsonb default '[]'::jsonb;
  items record;
begin
  raise warning 'public.get_current_user() = %', public.get_current_user();
  if public.get_current_user() is null then
    raise exception 'You must log in to issue credits' using errcode = 'LOGIN';
  end if;

  -- find user
  raise warning 'finding the current user details based on auth0_sub...';
  select *
  into v_tokenizer
  from "user"
  where auth0_sub = public.get_current_user();
  raise warning 'v_tokenizer = %', v_tokenizer;

  if v_tokenizer.id is null then
    raise exception 'User not found' using errcode = 'NTFND';
  end if;

  -- find org the current user is member of (take first one for now as it'll always be Regen Network)
  raise warning 'finding the first org that is associated with this user...';
  v_tokenizer_organization := get_user_first_organization(v_tokenizer.id);
  raise warning 'v_tokenizer_organization = %', v_tokenizer_organization;

  if v_tokenizer_organization.party_id is null then
    raise exception 'User should be part of an organization to issue credits in the name of this organization' using errcode = 'DNIED';
  end if;

  -- find project
  raise warning 'finding the project... project_id = %', project_id;
  select *
  into v_project
  from project
  where id = project_id;
  raise warning 'v_project = %', v_project;

  if v_project.id is null then
    raise exception 'Project not found' using errcode = 'NTFND';
  end if;

  for items in select * from party where id=v_tokenizer_organization.party_id loop
    raise warning 'MATCHED PARTY ROW: %', to_json(items); 
  end loop;
  for items in select * from wallet where party_id=v_tokenizer_organization.party_id loop
    raise warning 'MATCHED WALLET ROW: %', to_json(items); 
  end loop;

  -- get issuer's wallet id
  raise warning 'finding the issuers wallet id.... party_id = %', v_tokenizer_organization.party_id;
  v_tokenizer_wallet_id := public.get_wallet_id(v_tokenizer_organization.party_id);
  raise warning 'result for v_tokenizer_wallet_id = %', v_tokenizer_wallet_id;

  if v_tokenizer_wallet_id is null then
    raise exception 'Issuer must have a wallet' using errcode = 'NTFND';
  end if;

  -- verify current user is allowed to issue credits for this credit class
  select issuer_id
  into v_credit_class_issuer_id
  from credit_class_issuer
  where credit_class_id = v_project.credit_class_id and issuer_id = v_tokenizer_wallet_id;

  if v_credit_class_issuer_id is null then
    raise exception 'User not allowed to issue credits for this project' using errcode = 'DNIED';
  end if;

  -- verify sum initial_distribution values = 1
  select sum(jsonb_each_text.value::numeric)
  into v_sum
  from jsonb_each_text(initial_distribution);

  if v_sum != 1 then
    raise exception 'Sum of ownership breakdown not equal to 100' using errcode = 'DNIED';
  end if;

  -- Non 3rd party credits/internal
  if initial_issuer_id = uuid_nil() or reseller_id = uuid_nil() then
    -- create credit vintage
    insert into credit_vintage
    (start_date, end_date, credit_class_version_id, credit_class_version_created_at, methodology_version_id, methodology_version_created_at, project_id, tokenizer_id, units, initial_distribution, metadata, batch_denom)
    values (start_date, end_date, credit_class_version_id, credit_class_version_created_at, methodology_version_id, methodology_version_created_at, project_id, v_tokenizer_wallet_id, units, initial_distribution || '{"@type":"http://regen.network/CreditVintage"}'::jsonb, metadata, batch_denom)
    returning * into v_credit_vintage;

    -- create buffer pool and permanence reversal pool account balances
    for v_key, v_value IN
    select *
    from jsonb_each_text(metadata -> 'http://regen.network/bufferDistribution')
      loop
        if v_value != 0 then
          if v_key = 'http://regen.network/bufferPool' then
            select wallet.id from party into v_issuee_id
            inner join "user" on "user".email = 'bufferpool-registry@regen.network'
            inner join wallet on wallet.party_id = party.id 
            where party.id = "user".party_id;
          end if;

          if v_key = 'http://regen.network/permanenceReversalBuffer' then
            select wallet.id from party into v_issuee_id
            inner join "user" on "user".email = 'permanence-registry@regen.network'
            inner join wallet on wallet.party_id = party.id 
            where party.id = "user".party_id;
          end if;

          insert into account_balance
            (credit_vintage_id, wallet_id, liquid_balance, burnt_balance)
          values
            (v_credit_vintage.id, v_issuee_id, v_value * units, 0);

          v_deduction = v_deduction - v_value;
          v_account_balances = v_account_balances || jsonb_build_object(
              'name', v_key,
              'percentage', v_value * 100,
              'amount', v_value * units
            );
          end if;

      end loop;

    -- create project stakeholders account balances
    for v_key, v_value IN
    select *
    from jsonb_each_text(initial_distribution)
      loop
        -- raise notice '%: %', v_key, v_value;
        if v_value != 0 then
          if v_key = 'http://regen.network/projectDeveloperDistribution' then
            if v_project.developer_id is null then
              raise exception 'Project does not have any project developer' using errcode = 'NTFND';
            end if;
            v_issuee_id := public.get_wallet_id(v_project.developer_id);
            raise warning 'v_issuee_id %', v_issuee_id;
          end if;

          if v_key = 'http://regen.network/landOwnerDistribution' then
            if v_project.land_owner_id is null then
              raise exception 'Project does not have any land owner' using errcode = 'NTFND';
            end if;
            v_issuee_id := public.get_wallet_id(v_project.land_owner_id);
            raise warning 'v_issuee_id %', v_issuee_id;
          end if;

          if v_key = 'http://regen.network/landStewardDistribution' then
            if v_project.steward_id is null then
              raise exception 'Project does not have any land steward' using errcode = 'NTFND';
            end if;
            v_issuee_id := public.get_wallet_id(v_project.steward_id);
            raise warning 'v_issuee_id %', v_issuee_id;
          end if;

          insert into account_balance
            (credit_vintage_id, wallet_id, liquid_balance, burnt_balance)
          values
            (v_credit_vintage.id, v_issuee_id, v_deduction * v_value * units , 0);
          v_account_balances = v_account_balances || jsonb_build_object(
              'name', v_key,
              'percentage', v_deduction * v_value * 100,
              'amount', v_deduction * v_value * units
            );
        end if;
      end loop;

  else
    -- create credit vintage
    insert into credit_vintage
    (start_date, end_date, issuer_id, reseller_id, credit_class_version_id, credit_class_version_created_at, methodology_version_id, methodology_version_created_at, project_id, tokenizer_id, units, initial_distribution, metadata, batch_denom)
    values (start_date, end_date, initial_issuer_id, reseller_id, credit_class_version_id, credit_class_version_created_at, methodology_version_id, methodology_version_created_at, project_id, v_tokenizer_wallet_id, units, initial_distribution || '{"@type":"http://regen.network/CreditVintage"}'::jsonb, metadata, batch_denom)
    returning * into v_credit_vintage;

    -- issue all credits to the reseller 
    insert into account_balance
      (credit_vintage_id, wallet_id, liquid_balance, burnt_balance)
    values
      (v_credit_vintage.id, reseller_id, units , 0);
    v_account_balances = v_account_balances || jsonb_build_object(
        'name', 'http://regen.network/reseller',
        'percentage', 100,
        'amount', units
      );
  end if;

  -- return v_credit_vintage;
  return jsonb_build_object(
    'creditVintageId', v_credit_vintage.id,
    'accountBalances', v_account_balances
  );
end;
$$ language plpgsql volatile
set search_path
to pg_catalog, public, pg_temp;
