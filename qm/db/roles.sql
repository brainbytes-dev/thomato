-- Laufzeitrolle qm_app (R36, R48, R49). Idempotent; wird bei jedem Lauf vollständig erneut erzwungen.
-- Das Passwort steht NIE hier: scripts/apply-roles.ts setzt es danach aus QM_APP_PASSWORD.
--
-- Betrieb:
--  * Nach JEDER Migration `pnpm db:roles` ausführen (neue Tabellen erhalten sonst nur die Default-Rechte).
--  * ALTER DEFAULT PRIVILEGES gilt nur für Objekte, die von der Rolle angelegt werden, die dieses
--    Statement ausführt. Migrationen und db:roles müssen deshalb mit derselben Besitzerrolle laufen.
--  * Neue UNVERÄNDERLICHE Tabellen (append-only) MÜSSEN im Block "Ausnahmen" unten ergänzt werden;
--    Default-Privilegien geben neuen Tabellen volle Rechte (SELECT, INSERT, UPDATE, DELETE).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'qm_app') THEN
    CREATE ROLE qm_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 50;
  END IF;
END
$$;

-- Kein attributändernder ALTER ROLE (NOSUPERUSER usw. verlangt SUPERUSER, z. B. auf Neon nicht verfügbar).
-- Stattdessen wird geprüft und abgebrochen, falls eine bereits vorhandene Rolle zu mächtig ist.
DO $$
DECLARE
  r pg_roles%ROWTYPE;
BEGIN
  SELECT * INTO r FROM pg_roles WHERE rolname = 'qm_app';
  IF r.rolsuper OR r.rolbypassrls OR r.rolreplication OR r.rolcreatedb OR r.rolcreaterole THEN
    RAISE EXCEPTION 'Rolle qm_app hat unzulässige Attribute (superuser=%, bypassrls=%, replication=%, createdb=%, createrole=%): bitte Rolle prüfen und korrigieren',
      r.rolsuper, r.rolbypassrls, r.rolreplication, r.rolcreatedb, r.rolcreaterole;
  END IF;
END
$$;

ALTER ROLE qm_app CONNECTION LIMIT 50;

GRANT USAGE ON SCHEMA public TO qm_app;
REVOKE CREATE ON SCHEMA public FROM qm_app;
-- Kein Zugriff auf das Migrations-Schema.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_namespace WHERE nspname = 'drizzle') THEN
    REVOKE ALL ON SCHEMA drizzle FROM qm_app;
    REVOKE ALL ON ALL TABLES IN SCHEMA drizzle FROM qm_app;
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO qm_app;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM qm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO qm_app;

-- Ausnahmen (bei jedem Lauf erneut erzwungen; neue unveränderliche Tabellen hier ergänzen):
REVOKE UPDATE, DELETE, TRUNCATE ON audit_event FROM qm_app;
REVOKE UPDATE, DELETE, TRUNCATE ON document_version FROM qm_app;
REVOKE DELETE ON measure FROM qm_app;  -- Massnahmen werden nie gelöscht (R31, R45, R48)

-- Künftige Tabellen und Sequenzen (nur für Objekte des ausführenden Besitzers).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO qm_app;
