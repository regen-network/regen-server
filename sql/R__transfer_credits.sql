create or replace function transfer_credits(
  vintage_id uuid,
  buyer_wallet_id uuid,
  address_id uuid,
  units numeric,
  credit_price numeric,
  tx_state transaction_state, -- TODO remove, not really needed
  broker_id uuid default uuid_nil(),
  stripe_id text default '',
  p_type purchase_type default 'offline'::purchase_type,
  currency char(10) default 'USD',
  contact_email text default '',
  auto_retire boolean default true,
  buyer_name text default '',
  receipt_url text default '',
  send_confirmation boolean default false,
  party_id uuid default uuid_nil(),
  user_id uuid default uuid_nil()
) returns jsonb as $$
declare
  v_user "user";
  v_initial_distribution jsonb;
  v_developer_id uuid;
  v_land_owner_id uuid;
  v_steward_id uuid;
  v_developer_wallet_id uuid;
  v_land_owner_wallet_id uuid;
  v_steward_wallet_id uuid;
  v_available_credits numeric;
  v_key text;
  v_value numeric;
  v_from uuid;
  v_buyer_account_balance account_balance;
  v_purchase_id uuid;
  v_project jsonb;
  v_credit_class_id uuid;
  v_credit_class_version credit_class_version;
  v_buyer_name text;
  v_email text;
  v_reseller_wallet_id uuid;
begin

  raise warning 'transfer_credits is a deprecated functionality';

  -- get number of available credits left for transfer
  -- (ie credits that are still part of the project stakeholders' liquid balances)
  select * from get_available_credits_record(vintage_id)
  into
    v_available_credits,
    v_initial_distribution,
    v_credit_class_id,
    v_developer_id,
    v_land_owner_id,
    v_steward_id,
    v_developer_wallet_id,
    v_land_owner_wallet_id,
    v_steward_wallet_id,
    v_project,
    v_reseller_wallet_id
  as (
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
    reseller_wallet_id uuid
  );

  if units > v_available_credits then
    raise exception 'Not enough available credits left to transfer' using errcode = 'DNIED';
  end if;

  -- create new purchase
  if party_id = uuid_nil() and user_id = uuid_nil() then
    insert into purchase
      ("stripe_id", type, "buyer_wallet_id", credit_vintage_id, "address_id")
    values
      (stripe_id, p_type, buyer_wallet_id, vintage_id, address_id)
    returning id into v_purchase_id;
  else
    insert into purchase
      ("stripe_id", type, "buyer_wallet_id", credit_vintage_id, "address_id", "party_id", "user_id")
    values
      (stripe_id, p_type, buyer_wallet_id, vintage_id, address_id, party_id, user_id)
    returning id into v_purchase_id;
  end if;

  if v_reseller_wallet_id is null then
    -- update project's stakeholders' account balances and create corresponding transactions
    for v_key, v_value in
    select *
    from jsonb_each_text(v_initial_distribution - '@type') -- removing @type field to get only numeric fields
      loop
        if v_value != 0 then
          if v_key = 'http://regen.network/projectDeveloperDistribution' then
            if v_developer_id is null then
              raise exception 'Project does not have any project developer' using errcode = 'NTFND';
            end if;
            v_from := v_developer_wallet_id;
          end if;

          if v_key = 'http://regen.network/landOwnerDistribution' then
            if v_land_owner_id is null then
              raise exception 'Project does not have any land owner' using errcode = 'NTFND';
            end if;
            v_from := v_land_owner_wallet_id;
          end if;

          if v_key = 'http://regen.network/landStewardDistribution' then
            if v_steward_id is null then
              raise exception 'Project does not have any land steward' using errcode = 'NTFND';
            end if;
            v_from := v_steward_wallet_id;
          end if;

          update account_balance set liquid_balance = liquid_balance - units * v_value
          where credit_vintage_id = vintage_id and wallet_id = v_from;

          if broker_id = uuid_nil() then
            if party_id = uuid_nil() then
              insert into transaction
                (from_wallet_id, to_wallet_id, state, units, credit_price, credit_vintage_id, purchase_id)
              values
                (v_from, buyer_wallet_id, tx_state, units * v_value, credit_price, vintage_id, v_purchase_id);
            else
              -- Use party_id as default broker_id for now since RND is doing the transfer and is the broker
              -- TODO look for broker info at the project level instead
              -- it might also be more consistent to have broker_id at the purchase (ie transfer) level too
              insert into transaction
                (broker_id, from_wallet_id, to_wallet_id, state, units, credit_price, credit_vintage_id, purchase_id)
              values
                (party_id, v_from, buyer_wallet_id, tx_state, units * v_value, credit_price, vintage_id, v_purchase_id);
            end if;
          else
            insert into transaction
              (broker_id, from_wallet_id, to_wallet_id, state, units, credit_price, credit_vintage_id, purchase_id)
            values
              (broker_id, v_from, buyer_wallet_id, tx_state, units * v_value, credit_price, vintage_id, v_purchase_id);
          end if;
        end if;
      end loop;
  else -- update reseller account balance
    update account_balance set liquid_balance = liquid_balance - units
    where credit_vintage_id = vintage_id and wallet_id = v_reseller_wallet_id;

    if broker_id = uuid_nil() then
      if party_id = uuid_nil() then
        insert into transaction
          (from_wallet_id, to_wallet_id, state, units, credit_price, credit_vintage_id, purchase_id)
        values
          (v_reseller_wallet_id, buyer_wallet_id, tx_state, units, credit_price, vintage_id, v_purchase_id);
      else
        -- Use party_id as default broker_id
        insert into transaction
          (broker_id, from_wallet_id, to_wallet_id, state, units, credit_price, credit_vintage_id, purchase_id)
        values
          (party_id, v_reseller_wallet_id, buyer_wallet_id, tx_state, units, credit_price, vintage_id, v_purchase_id);
      end if;
    else
      insert into transaction
        (broker_id, from_wallet_id, to_wallet_id, state, units, credit_price, credit_vintage_id, purchase_id)
      values
        (broker_id, v_reseller_wallet_id, buyer_wallet_id, tx_state, units, credit_price, vintage_id, v_purchase_id);
    end if;
  end if;

  -- create new account balance (or update) for the buyer
  insert into account_balance
    (credit_vintage_id, wallet_id, liquid_balance, burnt_balance)
  values
    (vintage_id, buyer_wallet_id, units, 0)
  on conflict on constraint account_balance_credit_vintage_id_wallet_id_key
  do update set liquid_balance = account_balance.liquid_balance + units
  where account_balance.credit_vintage_id = vintage_id and account_balance.wallet_id = buyer_wallet_id
  returning * into v_buyer_account_balance;

  -- build jsonb response
  -- credit class info
  select * from credit_class_version
  into v_credit_class_version
  where id = v_credit_class_id
  order by created_at desc limit 1;

  -- buyer's name
  if buyer_name = '' then
    select name into v_buyer_name from party where wallet_id = buyer_wallet_id;
  else
    v_buyer_name = buyer_name;
  end if;

  -- buyer's contact email
  if contact_email = '' then
    select * into v_email from get_wallet_contact_email(buyer_wallet_id);
  else
    v_email = contact_email;
  end if;

  -- retire credits if auto_retire true
  if auto_retire = true then
    perform retire_credits(vintage_id, buyer_wallet_id, address_id, units, '{}'::jsonb);
  end if;

  if send_confirmation = true then
    perform send_transfer_credits_confirmation(
      units,
      credit_price,
      currency,
      v_purchase_id ,
      v_credit_class_version,
      v_buyer_name,
      v_email,
      v_project,
      receipt_url
    );
  end if;
  
  return jsonb_build_object(
    'purchaseId', v_purchase_id,
    'project', v_project,
    'creditClass', jsonb_build_object(
      'name', v_credit_class_version.name,
      'metadata', v_credit_class_version.metadata
    ),
    'ownerName', v_buyer_name
  );
end;
$$ language plpgsql strict volatile
set search_path
to pg_catalog, public, pg_temp;

create or replace function send_transfer_credits_confirmation(
  units numeric,
  credit_price numeric,
  currency char(10),
  purchase_id uuid,
  credit_class_version credit_class_version,
  buyer_name text,
  email text,
  project jsonb,
  receipt_url text
) returns void as $$
begin
  perform graphile_worker
    .add_job
    (
      'credits_transfer__send_confirmation',
      json_build_object(
        'purchaseId', purchase_id,
        'project', project,
        'creditClass', jsonb_build_object(
          'name', credit_class_version.name,
          'metadata', credit_class_version.metadata
        ),
        'ownerName', buyer_name,
        'quantity', units,
        'amount', credit_price * units,
        'currency', currency,
        'email', email,
        'receiptUrl', receipt_url
      )
    );
end;
$$ language plpgsql strict volatile security definer
set search_path
to pg_catalog, public, pg_temp;
