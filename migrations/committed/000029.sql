--! Previous: sha1:279043272f4796772f4ea1b87bd9a53ef5cd6926
--! Hash: sha1:7a9123e95f186b72acb48de63be650f638aa2636

-- Enter migration here
GRANT
UPDATE (admin_party_id, published) ON project TO auth_user;
