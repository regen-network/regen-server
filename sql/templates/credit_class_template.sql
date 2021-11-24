DO $$ 
DECLARE
  -- Variables to provide values for
  -- Replace "TODO"s in the various metadata with appropriate values
  v_methodology_author_id uuid := ''; -- methodology author party id
  v_methodology_version text := '';
  v_methodology_name text := '';
  v_methodology_date_developed timestamptz := '';
  v_methodology_metadata jsonb := '{
    "@type": "http://regen.network/Methodology",
    "http://schema.org/url": {
      "@type": "http://schema.org/URL",
      "@value": "TODO"
    }
  }'::jsonb;
  v_credit_class_uri text := '';
  v_credit_class_standard boolean := true; -- is external standard
  v_credit_class_name text := '';
  v_credit_class_image text := '';
  v_credit_class_date_developed timestamptz := '';
  v_credit_class_metadata jsonb := '{
    "@type": "http://regen.network/CreditClass",
    "http://schema.org/url": {
      "@type": "http://schema.org/URL",
      "@value": "TODO"
    },
    "http://regen.network/SDGs": {
      "@list": [
        {
          "@id": "TODO - this should be the iri value of an SDG on Sanity",
          "@type": "http://regen.network/SDG"
        }
      ]
    },
    "http://regen.network/standard": {
      "http://schema.org/url": {
        "@type": "http://schema.org/URL",
        "@value": "TODO"
      },
      "http://schema.org/name": "TODO",
      "http://schema.org/version": "TODO",
      "http://regen.network/documentId": "TODO"
    },
    "http://regen.network/indicator": {
      "@id": "TODO - this should be the iri value of an Ecological Impact on Sanity",
      "@type": "http://regen.network/Indicator"
    },
    "http://regen.network/coBenefits": {
      "@list": [
        {
          "@id": "TODO - this should be the iri value of an Ecological Impact on Sanity",
          "@type": "http://regen.network/Indicator"
        }
      ]
    },
    "http://regen.network/creditDenom": "TODO",
    "http://regen.network/offsetGenerationMethod": "TODO"
  }'::jsonb;

  -- Variables set in the code
  v_methodology_id uuid;
  v_credit_class_id uuid;
BEGIN
  insert into methodology (author_id) values (v_methodology_author_id)
  returning id into v_methodology_id;

  insert into methodology_version (id, version, name, date_developed, metadata)
  values (v_methodology_id, v_methodology_version, v_methodology_name, v_methodology_date_developed, v_methodology_metadata);

  insert into credit_class (methodology_id, uri, standard)
  values (v_methodology_id, v_credit_class_uri, v_credit_class_standard);

  insert into credit_class_version (credit_class_id, name, date_developed, image, metadata)
  values (v_credit_class_id, v_credit_class_name, v_credit_class_date_developed, v_credit_class_image, v_credit_class_metadata);
END $$;