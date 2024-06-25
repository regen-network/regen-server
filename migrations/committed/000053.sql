--! Previous: sha1:f06415147ef75ea457adb790772bc4ee6b85b97a
--! Hash: sha1:4ec32466e8567c25ee1026ca12475e5acad11b58

DROP FUNCTION IF EXISTS delete_s3_file CASCADE;

CREATE FUNCTION delete_s3_file() RETURNS trigger AS $$
BEGIN
  PERFORM graphile_worker.add_job(
      'delete_s3_file',
      json_build_object(
        'id', NEW.id,
        'bucket', NEW.bucket,
        'key', NEW.key
      )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE TRIGGER delete_s3_file
  AFTER INSERT ON s3_deletion
  FOR EACH ROW
  EXECUTE PROCEDURE delete_s3_file();
