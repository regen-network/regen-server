# Migrations

This readme provides info about how to work with migrations in this repo.

## Local development

In order to develop this project locally we must use the following commands.
If this is your first time setting up the project locally, we need to initialize your database.
First, you must run the local database:

```
$ pwd
/Users/kyle/regen/regen-server
$ docker-compose up --build postgres
```

Then, you must initialize the database:

```
$ export DATABASE_URL="postgres://postgres:postgres@localhost:5432/regen_registry"
$ export SHADOW_DATABASE_URL="postgres://postgres:postgres@localhost:5432/regen_registry_shadow"
$ export ROOT_DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres"
$ yarn run graphile-migrate reset --erase
```

Now, we set up a watch process that will monitor `migrations/current.sql` for your changes as well as apply them to your local database:

```
$ yarn run graphile-migrate watch
```

When you are satisfied with the changes in `migration/current.sql`, you commit them:

```
$ yarn run graphile-migrate commit
```

By committing your changes you should see a new SQL file in `migration/committed/`.

## Schema Snapshot

The schema snapshot is stored and tracked in version control as `migrations/schema_snapshot.sql`.
Each time you apply a migration in local development this snapshot will be automatically updated.
See `.gmrc` and `afterAllMigrations` from [the `graphile-migrate` configuration docs](https://github.com/graphile/migrate#configuration) for how this is done.
This allows us to keep track of the changes being introduced to the schema.
You must commit your changes to this file.

This is a helpful file to keep in mind when you have questions about entities in the database.
For example, it allows you to also view the functions in the database being used in various RLS policies.
Similarly, you can view the various policies in the database or which tables have RLS enabled.

## Deploying to staging or production

The migrations are always automatically run in Heroku for staging and production.
See the `migrate` command in `server/package.json` and `Procfile` for Heroku.

## Debugging

This section contains some notes that may be useful for debugging common scenarios.

### Viewing migrations applied in a particular database

Our migration tool tracks which migrations have been applied in the following table:

```
regen_registry=# select * from graphile_migrate.migrations;
                     hash                      | previous_hash |  filename  |             date
-----------------------------------------------+---------------+------------+-------------------------------
 sha1:28ab5499d9a4520daa9428681a9bf1152f9887af |               | 000001.sql | 2023-05-08 20:20:31.213547+00
```

This is one way that you can track the migrations that will be deployed to staging or production.
