ALTER TABLE party
    DROP CONSTRAINT IF EXISTS party_account_id_fkey;

ALTER TABLE party
    ADD CONSTRAINT party_account_id_fkey FOREIGN KEY (account_id) REFERENCES account (id) ON DELETE CASCADE;
