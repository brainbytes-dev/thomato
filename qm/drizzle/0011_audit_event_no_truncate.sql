/*
 * audit_event ist bereits gegen UPDATE und DELETE gesperrt (0002). TRUNCATE löst keine Zeilentrigger aus und bliebe dem
 * Besitzer sonst offen, auch über TRUNCATE ... CASCADE von organization oder "user" aus. Dieser Statement-Trigger schliesst
 * die Lücke wie 0010 bei measure_review.
 *
 * Die Sitzungsvariable qm.allow_truncate ist nur ein Schutz gegen Versehen, keine Sicherheitsgrenze: Wer Besitzerrechte
 * hat, kann den Trigger auch löschen. Test- und Seed-Resets setzen sie ausdrücklich per SET LOCAL.
 */
CREATE OR REPLACE FUNCTION audit_event_no_truncate() RETURNS trigger AS $$
BEGIN
  IF current_setting('qm.allow_truncate', true) = 'on' THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'audit_event is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_event_no_truncate
  BEFORE TRUNCATE ON audit_event
  FOR EACH STATEMENT EXECUTE FUNCTION audit_event_no_truncate();
