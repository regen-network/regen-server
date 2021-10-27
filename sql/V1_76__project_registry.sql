alter table project drop constraint project_registry_id_fkey;
alter table project add foreign key ("registry_id") REFERENCES party ("id");
drop table registry;

