ALTER TABLE credit_class
    ADD COLUMN on_chain_id text unique;

create index on project("handle"); 

