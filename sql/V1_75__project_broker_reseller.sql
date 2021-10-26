alter table project add column broker_id uuid;
alter table project add foreign key ("broker_id") references party ("id");
create index on project
("broker_id");

alter table project add column reseller_id uuid;
alter table project add foreign key ("reseller_id") references party ("id");
create index on project
("reseller_id");

