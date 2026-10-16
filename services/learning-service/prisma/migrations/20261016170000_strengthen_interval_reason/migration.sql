BEGIN;

LOCK TABLE "enrollment_status_intervals" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "enrollment_status_intervals"
    WHERE NOT (
      (kind = 'Exempted' AND reason IS NOT NULL AND length(btrim(reason)) > 0)
      OR (kind = 'Halted' AND reason IS NULL)
    )
  ) THEN
    RAISE EXCEPTION 'Existing enrollment status intervals violate the reason constraint';
  END IF;
END $$;

ALTER TABLE "enrollment_status_intervals" DROP CONSTRAINT "ck_intervals_reason";
ALTER TABLE "enrollment_status_intervals" ADD CONSTRAINT "ck_intervals_reason"
  CHECK (
    (kind = 'Exempted' AND reason IS NOT NULL AND length(btrim(reason)) > 0)
    OR (kind = 'Halted' AND reason IS NULL)
  );

COMMIT;
