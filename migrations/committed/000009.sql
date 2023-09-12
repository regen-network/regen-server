--! Previous: sha1:5666f1ac7ef6e4f614dc524337da6b535d0787a6
--! Hash: sha1:b3d3e5b9cb7c46d76d12a0270d77d95aaeed5bb7

ALTER TABLE party DROP CONSTRAINT IF EXISTS has_account_or_creator;
ALTER TABLE 
  party 
ADD 
  COLUMN IF NOT EXISTS creator_id UUID REFERENCES account (id), 
ADD 
  CONSTRAINT has_account_or_creator CHECK (
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

REVOKE
UPDATE ON party
FROM
  auth_user;

GRANT
UPDATE (
  type,
  name,
  description,
  image,
  bg_image,
  twitter_link,
  website_link
) ON party TO auth_user;

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
