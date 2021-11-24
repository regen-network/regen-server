# Entity creation templates

This folder contains sql files that can be run to create new methodologies, credit classes and projects and contains JSON-LD `metadata` templates to be filled in for these entities.

1. Duplicate `credit_class_template.sql` and edit its copy to provide values for creating new `methodology`, `methodology_version`, `credit_class` based on the previous `methodology` and `credit_class_version`.
This requires an existing `party` for setting the `v_methodology_author_id` (you can use `really_create_user_if_needed` and/or `really_create_organization_if_needed` functions to do that or just use an existing `party`).

Once all the values are provided, just run:
```sh
psql {database_connection_info} -f credit_class_template_copy.sql
```
e.g. for your local database:
```sh
psql postgresql://postgres:postgres@localhost:5432/regen_registry -f credit_class_template_copy.sql
```

1. Once you have a credit class, you can create a new `project` for this credit class using `project_template.sql`. Same as in 1., duplicate and edit its copy to provide project data. This requires an existing `party` for setting the `v_registry_id` (you can use `really_create_user_if_needed` and/or `really_create_organization_if_needed` functions to do that or just use an existing `party`).
In particular, the project metadata should contain at least a `http://regen.network/projectDeveloper`, `http://regen.network/projectOriginator`, `http://regen.network/landSteward` or `http://regen.network/landOwner` that should follow one of the formats from `project-stakeholder.json` based on the `party` type (`Organization` or `Individual`) and whether there should be shown on the project page or not. The corresponding `user`, `organization` and `party` will be created in the corresponding database tables based on the provided project metadata.

Once all the values are provided, just run:
```sh
psql {database_connection_info} -f project_template_copy.sql
```
e.g. for your local database:
```sh
psql postgresql://postgres:postgres@localhost:5432/regen_registry -f project_template_copy.sql
```