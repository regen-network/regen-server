ALTER TABLE credit_vintage
    ADD COLUMN batch_denom text;

ALTER TABLE credit_vintage
    ADD UNIQUE (batch_denom);
