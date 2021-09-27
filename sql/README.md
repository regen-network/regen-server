# Tips for creating and running Flyway migrations

Flyway has two types of migrations: [repeatable](https://flywaydb.org/documentation/concepts/migrations#repeatable-migrations) and [versioned migrations](https://flywaydb.org/documentation/concepts/migrations#versioned-migrations). 

### Repeatable migrations

Repeatable migrations are re-run everytime they change and are mostly used for (re)creating functions here, which is why we need to use `CREATE OR REPLACE` clause. In addition to that, if we want to change an existing function parameters, `DROP FUNCTION IF EXISTS {function_name};` is needed. Indeed, if the function isn't dropped, postgres will just create another function with the same name but different parameters (this would be an issue for PostGraphile which won't be able to resolve the function into a single GraphQL mutation).

*Dev tip*:

If by mistake multiple functions with the same name but different parameters are created, you can run the following SQL command to get this list of functions:

```sql
SELECT format('DROP FUNCTION %I.%I(%s);'
            , n.nspname
            , p.proname
            , pg_catalog.pg_get_function_identity_arguments(p.oid)
             ) AS stmt
FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE  p.proname = '{function_name}'
AND n.nspname = 'public' -- schema name (optional)
ORDER  BY 1;
```
Finally, just run the `DROP FUNCTION` statement on the function that needs to be deleted.

### Versioned migrations

For versioned migrations, we use a streamlined version of SemVer, with only major and minor numbers, this is being used when naming migration files, e.g. `V1_10`. So far, we've only been incrementing the minor number but we might consider incrementing the major number too in case of major release.

*Dev tip*:

When adding complex row level security policies, it's usually best to add them manually and test them before dropping them and writing down their final version in a new migration, mainly for the reason exposed in the next section.

### Undoing migrations

[Flyway `undo` command](https://flywaydb.org/documentation/command/undo) is only available with the Teams plan, so it's recommended to make sure anything added to versioned migrations has the right logic in it.

In case of mistakes, it's always possible to create a new migration that reverts the last one, e.g. dropping a policy that is wrong or a column that is not relevant, but that means the migrations could get cluttered with "fixes" migrations so we should avoid those as much as possible.

*Dev tip*:
There is some hacky way of undoing Flyway migrations without the Teams plan.
TODO

