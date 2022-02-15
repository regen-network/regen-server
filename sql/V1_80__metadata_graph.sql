CREATE TABLE metadata_graph
(
  "iri" text PRIMARY KEY NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "metadata" jsonb NOT NULL
);

grant
  select
on metadata_graph to app_user;
