--- This role will be assigned to each wallet address that a user
--- will authenticate with. I.e. if a user signs in with regen12345
--- then we will have `CREATE ROLE regen12345 IN ROLE auth_user`.
--- This role will allow us to make it so the authn db functions can
--- only be used by these users. This secures the /graphiql endpoint
--- and of course secures the graphql server from public use of these
--- functions.
DO $$
BEGIN
    CREATE ROLE auth_user;
    GRANT app_user TO auth_user;
    COMMENT ON ROLE auth_user IS 'This is the user role that the keplr-based login system uses.';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE '%, skipping', SQLERRM USING ERRCODE = SQLSTATE;
END$$;
