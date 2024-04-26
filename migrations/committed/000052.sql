--! Previous: sha1:fd9c0b6eecc2142dce19df696187ebce98fca01e
--! Hash: sha1:8e3184e177d3b8f70ed3800152786830ae61f705

CREATE FUNCTION anchor_iri() RETURNS trigger AS $$
BEGIN
  PERFORM graphile_worker.add_job(
      'anchor_iri',
      json_build_object('iri', NEW.iri),
      'anchor_iri',
      NOW(),
      25,
      NEW.iri
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;


CREATE TRIGGER anchor_post
  AFTER INSERT ON post
  FOR EACH ROW
  EXECUTE PROCEDURE anchor_iri();

CREATE TRIGGER anchor_upload
  AFTER INSERT ON upload
  FOR EACH ROW
  EXECUTE PROCEDURE anchor_iri();

CREATE TRIGGER anchor_metadata_graph
  AFTER INSERT ON metadata_graph
  FOR EACH ROW
  EXECUTE PROCEDURE anchor_iri();
