--! Previous: sha1:5666f1ac7ef6e4f614dc524337da6b535d0787a6
--! Hash: sha1:c91904717572ef673c9e3b74f8d937d8dda75364

ALTER TABLE party DROP CONSTRAINT IF EXISTS cannot_have_account_and_creator;
ALTER TABLE 
  party 
ADD 
  COLUMN IF NOT EXISTS creator_id UUID REFERENCES account (id), 
ADD 
  CONSTRAINT cannot_have_account_and_creator CHECK (
    (
      account_id IS NULL 
      and creator_id IS NOT NULL
    ) 
    or (
      account_id IS NOT NULL 
      and creator_id IS NULL
    ) 
    or (
      account_id IS NULL 
      and creator_id IS NULL
    )
  );

CREATE INDEX IF NOT EXISTS party_creator_id_key ON party (creator_id);

DROP POLICY IF EXISTS party_update_only_by_creator on public.party;
CREATE POLICY party_update_only_by_creator ON public.party FOR 
UPDATE 
  USING (
    (
      id IN (
        SELECT 
          p.id 
        FROM 
          public.party p 
        WHERE 
          (
            p.creator_id IN (
              SELECT 
                get_current_account.account_id 
              FROM 
                public.get_current_account() get_current_account(account_id)
            )
          )
      )
    )
  );

DROP FUNCTION IF EXISTS private.create_new_account;
CREATE FUNCTION private.create_new_account(addr text, v_party_type public.party_type) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_addr text = addr;
    can_be_added boolean;
    v_account_id uuid;
    v_wallet_id uuid;
    v_party_id uuid;
BEGIN
    can_be_added := public.addr_can_be_added (v_addr);
    IF can_be_added THEN
        RAISE LOG 'trying to create new account for this addr';

        INSERT INTO account DEFAULT
            VALUES
            RETURNING
                id INTO v_account_id;

        INSERT INTO wallet (addr)
            VALUES (v_addr)
        ON CONFLICT ON CONSTRAINT
            wallet_addr_key
        DO UPDATE SET
            addr = v_addr
        RETURNING
            id INTO v_wallet_id;

        INSERT INTO party (account_id, TYPE, wallet_id)
            VALUES (v_account_id, v_party_type, v_wallet_id)
        ON CONFLICT ON CONSTRAINT
            party_wallet_id_key
        DO UPDATE SET
            account_id = v_account_id,
            creator_id = null
        RETURNING
            id INTO v_party_id;

        RAISE LOG 'new account_id %', v_account_id;
        RAISE LOG 'new party_id %', v_party_id;
        RAISE LOG 'new wallet_id %', v_wallet_id;
	RETURN v_account_id;
    END IF;
END;
$$;

DROP FUNCTION IF EXISTS private.add_addr_to_account;
CREATE FUNCTION private.add_addr_to_account(account_id uuid, addr text, v_party_type public.party_type) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_account_id uuid = account_id;
    v_addr text = addr;
    can_be_added boolean;
    v_wallet_id uuid;
    v_party_id uuid;
    v_current_user name;
BEGIN
    RAISE LOG 'v_account_id %', v_account_id;
    can_be_added := public.addr_can_be_added (v_account_id, v_addr);
    IF can_be_added THEN
        INSERT INTO wallet (addr)
            VALUES (v_addr)
        ON CONFLICT ON CONSTRAINT wallet_addr_key DO UPDATE SET
            addr = v_addr
        RETURNING
            id INTO v_wallet_id;
        RAISE LOG '_wallet_id %', v_wallet_id;

        SELECT
            party.id INTO v_party_id
        FROM
            party
        JOIN
            wallet
        ON
            wallet.id = party.wallet_id
        WHERE
            wallet.addr = v_addr;
        RAISE LOG 'v_party_id %', v_party_id;

        IF v_party_id is null THEN
          RAISE LOG 'creating new party...';
          SELECT * INTO v_party_id from uuid_generate_v1();
          INSERT INTO party (id, account_id, TYPE, wallet_id)
               VALUES (v_party_id, v_account_id, v_party_type, v_wallet_id);
          RAISE LOG 'new _party_id %', v_party_id;
        ELSE
          RAISE LOG 'associating preexisting party...';
          UPDATE party SET account_id = v_account_id, creator_id = null WHERE id = v_party_id ;
        END IF;
    END IF;
END;
$$;
