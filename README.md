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

### Environment variables

Based on `.env.example`, create some `.env` file with appropriate values.

## Caching
[Redis](https://redis.io//) is used for caching.
You will need to have Redis running locally. Install and run
```
redis-server
```
then set your REDIS_URL env variable (default is redis://localhost:6379).
TODO: see if we can use Docker for this. See Issue #527

## Starting a development server

1. Install all dependencies with `yarn`
2. Start a development server with `yarn dev`
3. Start coding!!

## Database migrations

[Flyway](https://flywaydb.org) is used to run migrations:
```sh
yarn migrate
```

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
The `schacl_graph` table has an `uri` as primary key and a jsonb column `graph` where a SCHACL graph is encoded as JSON-LD.
For instance, an entry with `http://regen.network/ProjectPlanShape` as URI can be created to store the SHACL graph to validate a [project plan](./schema/project-plan.ttl).



