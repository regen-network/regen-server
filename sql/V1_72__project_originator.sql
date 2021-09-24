alter table project add column originator_id uuid;
alter table project add foreign key ("originator_id") references party ("id");
create index on project
("originator_id");





