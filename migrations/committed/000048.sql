--! Previous: sha1:bc83279a356a9f18f123acbe0bf1284b5d769911
--! Hash: sha1:fbc8aac5a69cc527e0ac833595eba33770cfcafe

DROP TABLE IF EXISTS project_partner;
CREATE TABLE project_partner(
  project_id UUID REFERENCES project(id),
  account_id UUID REFERENCES account(id),
  CONSTRAINT project_partner_pk PRIMARY KEY(project_id, account_id) 
);
