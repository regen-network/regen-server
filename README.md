# Registry Server

## Prerequisites

- [NodeJS](https://nodejs.org/en/)
- [Yarn](https://yarnpkg.com/en/)
- [Docker](https://www.docker.com).

[NVM](https://github.com/nvm-sh/nvm) is recommended for managing NodeJS
installations and we are intending to stick to the
[LTS](https://github.com/nvm-sh/nvm#long-term-support) releases of NodeJS for
this project.

After installing `nvm`, this sequence of commands will provide you with an LTS
version of nodejs and access to `yarn`:

```
$ nvm install --lts
$ nvm use --lts
$ corepack enable
$ yarn --help
```

At present the application is known to be compatible with
nodejs versions 10.x, 14.x and 16.x. For information about
which version is deployed on Heroku for the staging and production
server, see the `engines` section in `package.json`. Read here for
[more info](https://devcenter.heroku.com/articles/nodejs-support#specifying-a-node-js-version).

## Setup

### Starting PostgreSQL and Redis Locally

1. Install [docker-compose](https://docs.docker.com/compose/install/)
2. Run `cd server && docker-compose up`

#### Postgres info

The database can then be accessed using:
```sh
psql postgresql://postgres:postgres@localhost:5432/regen_registry
```

#### Redis info

[Redis](https://redis.io//) is used for caching. See `REDIS_URL` in `server/.env.example`.
You can connect to redis using the `redis-cli`:

```
cd server && docker-compose exec redis redis-cli
```

### Environment variables

Based on `server/.env.example`, create some `server/.env` file with appropriate values.

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
DROP ROLE app_user;
CREATE DATABASE regen_registry;
```

Then [run the migrations](#migrations) and you're ready to go again!

## Tests

[Jest](https://jestjs.io/) is used for testing:
```sh
yarn test
```

Right now, it's using the development database.
TODO: Use a separate testing database instead and set up new migration command.

## Linting and code formatting 

This repo is configured to run prettier with eslint, in addition to some other
common linting rules for eslint and eslint typescript. The setup was created by
following [the eslint getting started][1] as well as [the prettier docs for
integrating with linters][2].

To run the linter and formatter for the whole project:
```sh
yarn run eslint .
```

To run the linter and formatter for the whole project, only showing "error"s:
```sh
yarn run eslint --quiet .
```

To run the linter and formatter for a specific file:
```sh
yarn run eslint <path-to-files>
```

To automatically apply fixes where possible use `--fix`:
```sh
yarn run eslint <path-to-files> --fix
```

## SHACL Graphs

[SHACL](https://www.w3.org/TR/shacl/) schemas have been migrated to https://github.com/regen-network/regen-registry-standards

These graphs can be stored too in the PostGres database in the `schacl_graph` table in order to be queried using GraphQL and used for client-side validation.
The `schacl_graph` table has an `uri` as primary key and a jsonb column `graph` where a SHACL graph is encoded as JSON-LD.
For instance, an entry with `http://regen.network/ProjectPlanShape` as URI can be created to store the SHACL graph to validate a project plan.

## IRI Generation for JSON-LD data

IRIs can be generated based on JSON-LD data using the following command:

```sh
cd iri-gen && yarn gen json_file_path
```

IRIs can be generated and inserted to the database using the `--insert`
flag. Note: You need to create an `iri-gen/.env` when using this flag for
the staging or production environment. See `iri-gen/.env-example`.

```sh
cd iri-gen && yarn gen --insert json_file_path
```

[1]: https://eslint.org/docs/user-guide/getting-started
[2]: https://prettier.io/docs/en/integrating-with-linters.html 
