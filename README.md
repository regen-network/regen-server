# Regen Server

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
$ nvm install
$ nvm use
$ corepack enable
$ yarn --help
```

Note: the `.nvmrc` file in this repo determines which node version is used locally.

At present the application is known to be compatible with
nodejs versions 10.x, 14.x and 16.x. For information about
which version is deployed on Heroku for the staging and production
server, see the `engines` section in `package.json`. Read here for
[more info](https://devcenter.heroku.com/articles/nodejs-support#specifying-a-node-js-version).

## Setup

### Starting PostgreSQL and Redis Locally

1. Install [docker-compose](https://docs.docker.com/compose/install/)
2. Run `docker-compose up --build postgres redis`

#### Postgres info

The database can then be accessed using:

```sh
psql postgresql://postgres:password@localhost:5432/server
```

#### Redis info

[Redis](https://redis.io//) is used for caching. See `REDISCLOUD_URL` in `server/.env.example`.
You can connect to redis using the `redis-cli`:

```
docker-compose exec redis redis-cli
```

### Environment variables

Based on `server/.env.example`, create some `server/.env` file with appropriate values.
To get the app running you can fill in missing values with an arbitrary string value.

## Starting a development server

1. Install all dependencies with `yarn`.
2. Run this apps migrations: https://github.com/regen-network/regen-server/blob/dev/migrations/README.md
3. Run the indexer migrations: https://github.com/regen-network/indexer/blob/main/migrations/README.md
4. Start a development server with `(cd server && yarn start-dev)`.
5. Start coding!!

## Database

### Configuring postgres logging

Need verbose logging? Run this SQL command in `psql` or similar:

```sql
# the line below adjusts log level of the postgres daemon to include a lot of info..
alter database regen_registry set log_statement = 'all';
# the line below adjusts the client (psql) to display level debug or higher messages..
set client_min_messages to 'debug';
```

See [the postgres errors and messages documentation][6] for more info.

### Postgraphile

We make use of postgraphile to autogenerate a graphql API. Here are some references for
understanding how to work with postgraphile:

- https://www.graphile.org/postgraphile/required-knowledge/
- https://www.graphile.org/postgraphile/quick-start-guide/
- https://learn.graphile.org/docs/PostgreSQL_Row_Level_Security_Infosheet.pdf

### Migrations

Refer to [migrations/README.md](migrations/README.md).

### Seeding

The following section describes how to seed your local database with production data in order to facilitate local feature development and testing.

0. Make sure the production database and your local database are in sync with regards to migrations by verifying the latest migration version number on `master` and on your local branch in `sql` folder. Otherwise that may cause unexpected behavior when trying to seed your local database with production data.
   It's also recommended to start from a local database without any data, otherwise existing data might conflict with production data which could lead to constraint errors (e.g. unique constraint error in the case of multiple `user`s with the same email).

1. Export data from the production database using `pg_dump`:

```sh
pg_dump -d postgres -h registryproduction.cna6zybeqdns.us-east-1.rds.amazonaws.com -p 5432 -U postgres --file dump --data-only -F c
```

You'll be asked for the database password, if you don't know where to find it, please contact one of the contributors of this repository.
After entering the password, this might take a few seconds before data is exported into `dump`.

2. Import production data to your local database using (the password is just `postgres` for your local database):

```sh
pg_restore -d regen_registry -h localhost -p 5432 -U postgres dump
```

### Dropping local database

If for some reasons, your database is in a messy state and it's best to just restart from scratch, you may want to drop the database and recreate it.

Make sure your [postgres Docker container is running](#starting-postgresql-locally) and then run:

```
yarn run graphile-migrate reset --erase
```

And you're ready to go again!

## Tests

[Jest](https://jestjs.io/) is used for testing:

In order for all tests to pass you'll need to have set up values correctly in:

```
server/.env-test
server/.env-test-secrets
```

Tests can be run with:

```sh
yarn test
```

You can skip e2e tests that depend on AWS, this is helpful when you don't have S3 credentials:

```sh
SKIP_AWS_TESTS=1 yarn test
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

## API Documentation

We make use of swagger-ui-express and swagger-jsdoc to generate documentation
for certain API endpoints within the routes folder. Any openapi specifications
that are found within routes in jsdoc style comments will be automatically
converted into swagger-style API documentation. i.e. search for `@openapi` to
find samples of openapi docs that we use in the project. [This tutorial][5] covers
the basic concepts involved in writing an openapi specification.

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

## Manual Deployment

If you need to deploy the app manually, you can download [the Heroku CLI][4] and
use the following commands to deploy from your local environment.

### Authenticate the Heroku CLI

```
$ heroku login
```

Optional: Test the above by viewing the apps available to the our team.

```
$ heroku apps --team=regen-network
=== Apps in team regen-network
...
regen-server
regen-server-staging
...
```

### Checkout and synchronize the code you want to deploy

If you are deploying to staging:

```
$ git checkout dev
$ git pull
```

If you are deploying to production:

```
$ git checkout master
$ git pull
```

### Set up a git remote for the heroku app you want to deploy

If you are deploying to staging:

```
$ heroku git:remote -r regen-server-staging -a regen-server-staging
```

If you are deploying to production:

```
$ heroku git:remote -r regen-server -a regen-server
```

Your git remotes should like this:

```
$ git remote -v
origin	git@github.com:regen-network/regen-server.git (fetch)
origin	git@github.com:regen-network/regen-server.git (push)
regen-server-staging	https://git.heroku.com/regen-server-staging.git (fetch)
regen-server-staging	https://git.heroku.com/regen-server-staging.git (push)
regen-server	https://git.heroku.com/regen-server.git (fetch)
regen-server	https://git.heroku.com/regen-server.git (push)
```

### Deploy the dev or master branch to heroku

To finish a deploy to staging, we need to push the `dev` branch:

```
$ git push regen-server-staging dev:main
```

To finish a deploy to production, we need to push the `master` branch:

```
$ git push regen-server master:main
```

Note: When you are deploying a branch, Heroku requires it to be `<branch>:main`.

For more on this manual process, see [the Heroku docs][3].

[1]: https://eslint.org/docs/user-guide/getting-started
[2]: https://prettier.io/docs/en/integrating-with-linters.html
[3]: https://devcenter.heroku.com/articles/git
[4]: https://devcenter.heroku.com/articles/heroku-cli
[5]: https://support.smartbear.com/swaggerhub/docs/tutorials/openapi-3-tutorial.html
[6]: https://www.postgresql.org/docs/current/plpgsql-errors-and-messages.html
