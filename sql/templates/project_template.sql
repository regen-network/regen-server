DO $$ 
DECLARE
  -- Variables to provide values for
  -- Replace "TODO"s in v_metadata with appropriate values
  v_handle text := '';
  v_creator_id uuid := ''; -- your user id
  v_registry_id uuid := ''; -- existing party id of the registry the project belongs to
  v_broker_id uuid; -- optional broker party id (e.g. party id of Regen Network Development, Inc)
  v_reseller_id uuid; -- optional reseller party id (e.g. party id of Regen Network Development, Inc)
  v_metadata jsonb := '{
  "@type": [
    "http://regen.network/ProjectPage",
    "http://regen.network/Project"
  ],
  "http://regen.network/creditClass": {
    "@id": "TODO - credit_class.uri value of an existing credit_class",
    "@type": "http://regen.network/CreditClass"
  },
  "http://schema.org/name": "TODO",
  "http://regen.network/glanceText": {
    "@list": [
      "TODO",
      "TODO"
    ]
  },
  "http://schema.org/location": {
    "@context": {
      "type": "@type",
      "@vocab": "https://purl.org/geojson/vocab#",
      "coordinates": {
        "@container": "@list"
      }
    },
    "TODO": "use https://docs.mapbox.com/playground/geocoding/ to get the geojson data response for the address"
  },
  "http://regen.network/boundaries": {
    "@type": "http://schema.org/URL",
    "@value": "TODO"
  },
  "http://regen.network/size": {
    "http://qudt.org/1.1/schema/qudt#unit": {
      "@type": "http://qudt.org/1.1/schema/qudt#unit",
      "@value": "TODO - http://qudt.org/1.1/vocab/unit#HA or http://qudt.org/1.1/vocab/unit#AC"
    },
    "http://qudt.org/1.1/schema/qudt#numericValue": {
      "@type": "http://www.w3.org/2001/XMLSchema#double",
      "@value": "TODO"
    }
  },
  "http://regen.network/projectDeveloper": "TODO if applicable - use project-stakeholder.json as template",
  "http://regen.network/projectOriginator": "TODO if applicable - use project-stakeholder.json as template",
  "http://regen.network/landSteward": "TODO if applicable - use project-stakeholder.json as template",
  "http://regen.network/landOwner": "TODO if applicable - use project-stakeholder.json as template",
  "http://regen.network/landStory": "TODO",
  "http://regen.network/landStewardStory": "TODO",
  "http://regen.network/landStewardStoryTitle": "TODO",
  "http://regen.network/projectQuote": {
    "http://regen.network/quote": "TODO projectQuote optional",
    "http://schema.org/name": "TODO projectQuote optional",
    "http://schema.org/jobTitle": "TODO projectQuote optional"
  },
  "http://regen.network/previewPhoto": {
    "@type": "http://schema.org/URL",
    "@value": "TODO"
  },
  "http://regen.network/galleryPhotos": {
    "@list": [
      {
        "@type": "http://schema.org/URL",
        "@value": "TODO"
      },
      {
        "@type": "http://schema.org/URL",
        "@value": "TODO"
      },
      {
        "@type": "http://schema.org/URL",
        "@value": "TODO"
      },
      {
        "@type": "http://schema.org/URL",
        "@value": "TODO"
      }
    ]
  },
  "http://regen.network/videoURL": {
    "@type": "http://schema.org/URL",
    "@value": "TODO if no http://regen.network/landStewardPhoto"
  },
  "http://regen.network/landStewardPhoto": {
    "@type": "http://schema.org/URL",
    "@value": "TODO if no http://regen.network/videoURL"
  },
  "http://regen.network/boundaries": {
    "@type": "http://schema.org/URL",
    "@value": "TODO"
  },
  "http://regen.network/landManagementActions": {
    "@list": [
      {
        "http://schema.org/image": {
          "@type": "http://schema.org/URL",
          "@value": "TODO"
        },
        "http://schema.org/name": "TODO",
        "http://schema.org/description": "TODO"
      }
    ]
  }
}'::jsonb;

  -- Variables set in the code
  v_credit_class_id uuid;
  v_address_id uuid;
  v_project_developer_id uuid;
  v_project_originator_id uuid;
  v_land_owner_id uuid;
  v_land_steward_id uuid;
BEGIN
  -- Create project `address`
  insert into address (feature) values ((v_metadata->'http://schema.org/location')::jsonb)
  returning id into v_address_id;

  -- Get credit class id from credit class uri
  select id from credit_class where uri = v_metadata->'http://regen.network/creditClass'->>'@id'
  into v_credit_class_id;

  if v_credit_class_id is null then
    raise exception 'Credit class not found' using errcode = 'NTFND';
  end if;

  insert into project
    (handle, creator_id, credit_class_id, registry_id, address_id, metadata)
  values (
    v_handle,
    v_creator_id,
    v_credit_class_id,
    v_registry_id,
    v_address_id,
    v_metadata
  );

  -- Create and set project stakeholders
  v_project_developer_id = private.create_project_stakeholder((v_metadata->'http://regen.network/projectDeveloper')::jsonb);
  if v_project_developer_id is not null then
    update project set developer_id=v_project_developer_id where handle=v_handle;
  end if;
  v_project_originator_id = private.create_project_stakeholder((v_metadata->'http://regen.network/projectOriginator')::jsonb);
  if v_project_originator_id is not null then
    update project set originator_id=v_project_originator_id where handle=v_handle;
  end if;
  v_land_owner_id = private.create_project_stakeholder((v_metadata->'http://regen.network/landOwner')::jsonb);
  if v_land_owner_id is not null then
    update project set land_owner_id=v_land_owner_id where handle=v_handle;
  end if;
  v_land_steward_id = private.create_project_stakeholder((v_metadata->'http://regen.network/landSteward')::jsonb);
  if v_land_steward_id is not null then
    update project set steward_id=v_land_steward_id where handle=v_handle;
  end if;

  if v_broker_id is not null then
    update project set broker_id=v_broker_id where handle=v_handle;
  end if;
  if v_reseller_id is not null then
    update project set reseller_id=v_reseller_id where handle=v_handle;
  end if;
END $$;