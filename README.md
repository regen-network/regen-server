# Registry Server

## Prerequisites

Make sure [NodeJS](https://nodejs.org/en/) v8.9.x, [Yarn](https://yarnpkg.com/en/), and [Docker](https://www.docker.com).

[NVM](https://github.com/creationix/nvm) is recommended for managing NodeJS installations and we
are intending to stick to the [LTS](https://github.com/creationix/nvm#long-term-support) releases
of NodeJS for this project.

## Setup

### Starting PostgreSQL Locally

1. Install [docker-compose](https://docs.docker.com/compose/install/)
2. Run `cd server && docker-compose up`

The database can then be accessed using:
```sh
psql postgresql://postgres:postgres@localhost:5432/regen_registry
```

### Environment variables

Based on `.env.example`, create some `.env` file with appropriate values.

## Caching

[Redis](https://redis.io//) is used for caching.
You will need to have Redis running locally. Install and run
```sh
redis-server
```
then set your REDIS_URL env variable (default is redis://localhost:6379).
TODO: see if we can use Docker for this. See https://github.com/regen-network/regen-web/issues/527

## Starting a development server

1. Install all dependencies with `yarn`.
2. Start a development server with `yarn dev`. This runs in parallel the node `server` and watches/builds code in the `worker` (used for sending emails at the moment).
3. Start coding!!

## Database

### Migrations

[Flyway](https://flywaydb.org) is used to run migrations:
```sh
yarn migrate
```

For more tips related to migrations, refer to [sql/README.md](sql/README.md).

### Seeding

The following section describes how to seed your local database with production data in order to facilitate local feature development and testing.

0. Make sure the production database and your local database are in sync with regards to migrations by verifying the latest migration version number on `master` and on your local branch in `sql` folder. Otherwise that may cause unexpected behavior when trying to seed your local database with production data.
You can also run `yarn dbinfo` locally to check your local migrations status in more details.
It's also recommended to start from a local database without any data, otherwise existing data might conflict with production data which could lead to constraint errors (e.g. unique constraint error in the case of multiple `user`s with the same email).

1. Export data from the production database using `pg_dump`:
```sh
pg_dump -d postgres -h registryproduction.cna6zybeqdns.us-east-1.rds.amazonaws.com -p 5432 -U postgres --file dump.sql --data-only
```
You'll be asked for the database password, if you don't know where to find it, please contact one of the contributors of this repository.
After entering the password, this might take a few seconds before data is exported into `dump.sql`.

2. Import production data to your local database using:
```sh
psql postgresql://postgres:postgres@localhost:5432/regen_registry -f dump.sql
```

### Dropping local database

If for some reasons, your database is in a messy state and it's best to just restart from scratch, you may want to drop the database and recreate it.

After connecting to postgres (`psql postgresql://postgres:postgres@localhost:5432`, make sure your [postgres Docker container is running](#starting-postgresql-locally)), run sequentially:
```sql
DROP DATABASE regen_registry;
CREATE DATABASE regen_registry;
DROP ROLE app_user;
```

Then [run the migrations](#migrations) and you're ready to go again!

## Tests

[Jest](https://jestjs.io/) is used for testing:
```sh
yarn test
```

Right now, it's using the development database.
TODO: Use a separate testing database instead and set up new migration command.

## SHACL Graphs

[SHACL](https://www.w3.org/TR/shacl/) schemas have been migrated to https://github.com/regen-network/regen-registry-standards

These graphs can be stored too in the PostGres database in the `schacl_graph` table in order to be queried using GraphQL and used for client-side validation.
The `schacl_graph` table has an `uri` as primary key and a jsonb column `graph` where a SHACL graph is encoded as JSON-LD.
For instance, an entry with `http://regen.network/ProjectPlanShape` as URI can be created to store the SHACL graph to validate a project plan.



