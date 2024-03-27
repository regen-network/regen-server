--! Previous: sha1:03904343f3fa27b1a1531a7b465a4b36583f491b
--! Hash: sha1:3d29a2926c40a85b153f03a17d1e9bcd5ff44807

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
