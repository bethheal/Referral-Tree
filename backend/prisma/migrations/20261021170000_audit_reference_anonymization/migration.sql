-- Preserve immutable audit contents while allowing referenced user records to be anonymized.
CREATE OR REPLACE FUNCTION reject_append_only_mutations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND TG_TABLE_NAME = 'AuditLog'
     AND ((OLD."actorUserId" IS NOT NULL AND NEW."actorUserId" IS NULL)
       OR (OLD."targetUserId" IS NOT NULL AND NEW."targetUserId" IS NULL))
     AND (to_jsonb(NEW) - 'actorUserId' - 'targetUserId') = (to_jsonb(OLD) - 'actorUserId' - 'targetUserId') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'append-only record cannot be updated or deleted' USING ERRCODE = '55000';
END;
$$;
