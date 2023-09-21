--! Previous: sha1:1fcd1733c6fab18564bde744ad2c10ffad3de609
--! Hash: sha1:e2d13222c56f009e82632ea56c7fc29e787ca58a

-- Enter migration here
ALTER TABLE IF EXISTS project
ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT 'f';
