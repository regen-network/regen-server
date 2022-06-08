DROP TABLE IF EXISTS account CASCADE;
CREATE TABLE IF NOT EXISTS account (
    id uuid DEFAULT uuid_generate_v1() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
)
