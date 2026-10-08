- [x] Plan 4/5/6 night job complete; demo deployed (protected). Open: Henrik reviews morning report, remove duplicate empty Neon resource (iad1) in Vercel dashboard, reseed before demo.

## Plan 7: Freeze, Rehearsal & Pitch Hardening (ab 2026-10-08)
- [x] R51: echter 404 (Proxy-Check, auf Vercel verifiziert: 404/404/307)
- [x] Zugangsprozess dokumentiert (qm/docs/demo/ACCESS.md)
- [x] Demo-Flow live automatisiert (5 Rollen 61/61, Owner-Pfad 10/10, Reseed erledigt)
- [x] Fallback-Screenshots final
- [x] UI-Copy geglättet, Pitch-Narrativ aktualisiert
- [x] Feature Freeze (Plan 7 COMPLETE)
- Backlog nach Freeze: Stitch-Kriteriendetail (8/4-Layout), Massnahmen-Register, PDCA-Stufe B. Nicht jetzt.
- Hygiene: leeres Neon-Resource iad1 im Vercel-Dashboard löschen; Production-Branch auf feat/qm-foundation stellen (optional)

## Plan 8 (feat/qm-plan8, eigene Preview-DB, pitch-candidate unberührt)
- [x] 8.1 Kriteriendetail 8/4
- [x] 8.2 Massnahmen-Register
- [x] 8.3 PDCA (Datenmodell, Services, Detailseite, Register-Kennzahlen); 694 Tests
- [ ] Henrik: Preview durchklicken; Entscheidung, ob Plan 8 vor dem Pitch in feat/qm-foundation übernommen wird (dann db:deploy gegen Demo-DB + Seed neu)
- Backlog: Editor darf erledigte Massnahmen (Titel/Frist) ändern; Schritt entfernen ohne Rückfrage; audit_event TRUNCATE-Schutz; Verlauf paginieren
Backlog: document_version TRUNCATE trigger (own ticket)
- [ ] Pitch-Checkliste (Lizenzfrage an IVR u. a.): qm/docs/demo/PITCH-CHECKLIST.md
- [ ] Plan 9 (Wissen und Quellen): Spec+Plan freigegeben (docs/superpowers/plans/2026-10-08-qm-wissen-quellen.md), Start nach Plan-8-Merge auf feat/qm-plan9; D1 später nach IVR-Rückmeldung
