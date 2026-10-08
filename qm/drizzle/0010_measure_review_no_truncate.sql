CREATE OR REPLACE FUNCTION measure_review_no_truncate() RETURNS trigger AS $$
BEGIN
  /* Nur Test- und Seed-Resets setzen diese Sitzungsvariable ausdrücklich (SET LOCAL); im Betrieb bleibt TRUNCATE gesperrt. */
  IF current_setting('qm.allow_truncate', true) = 'on' THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'measure_review is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER measure_review_no_truncate
  BEFORE TRUNCATE ON measure_review
  FOR EACH STATEMENT EXECUTE FUNCTION measure_review_no_truncate();
