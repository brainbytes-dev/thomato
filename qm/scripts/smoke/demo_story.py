#!/usr/bin/env python3
"""Browser-Smoke-Test der Demo-Story (Nachweis veraltet -> neue Version -> Stand bewusst setzen).

ACHTUNG: Das Skript VERAENDERT Daten (laedt eine Version hoch und setzt 7.3.10 auf «Erfüllt»).
Danach die Datenbank neu seeden: pnpm seed:demo -- --yes-reset

Umgebungsvariablen: BASE_URL, QM_EMAIL, QM_PASSWORD, CHROMIUM_PATH, OUT_DIR, EXTRA_HTTP_HEADERS (JSON).
Exit-Code 0 nur, wenn alle Schritte bestanden sind.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path
from typing import Callable

from playwright.sync_api import Page, expect, sync_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
EMAIL = os.environ.get("QM_EMAIL", "owner@demo.qm.test")
PASSWORD = os.environ.get("QM_PASSWORD", "Demo-QM-2026")
CHROMIUM_PATH = os.environ.get("CHROMIUM_PATH") or None
OUT_DIR = Path(os.environ.get("OUT_DIR") or tempfile.mkdtemp(prefix="qm-smoke-"))
CRITERION = "7.3.10"
TIMEOUT_MS = 20_000


def demo_pdf(title: str) -> bytes:
    """Kleines gueltiges PDF (nur Header-Pruefung des Uploads und Anzeige noetig)."""
    stream = f"BT /F1 18 Tf 72 760 Td ({title}) Tj ET".encode("latin-1")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = b"%PDF-1.4\n"
    offsets: list[int] = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return out


failures: list[str] = []


def step(name: str, fn: Callable[[], None]) -> None:
    try:
        fn()
        print(f"PASS  {name}")
    except Exception as exc:  # noqa: BLE001 - jeder Fehler ist ein FAIL dieses Schritts
        failures.append(name)
        print(f"FAIL  {name}: {str(exc).splitlines()[0] if str(exc) else type(exc).__name__}")


def shot(page: Page, name: str) -> None:
    page.screenshot(path=str(OUT_DIR / f"{name}.png"), full_page=True)


def stat(page: Page, label: str) -> int:
    dd = page.get_by_text(label, exact=True).first.locator("xpath=following-sibling::dd")
    return int(dd.inner_text().strip())


def action_row_present(page: Page) -> bool:
    row = page.locator("li, tr").filter(has_text="Nachweis veraltet").filter(has_text=CRITERION)
    return row.count() > 0


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    headers_raw = os.environ.get("EXTRA_HTTP_HEADERS")
    headers: dict[str, str] = json.loads(headers_raw) if headers_raw else {}
    future = (date.today() + timedelta(days=365)).isoformat()
    pdf_path = OUT_DIR / "hygienekonzept-demo-v2.pdf"
    pdf_path.write_bytes(demo_pdf("Hygienekonzept (Demo) Version 2"))
    print(f"Screenshots: {OUT_DIR}")

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM_PATH)
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 1000},
            extra_http_headers=headers or None,
        )
        ctx.set_default_timeout(TIMEOUT_MS)
        page = ctx.new_page()
        state: dict[str, int] = {}

        def login() -> None:
            page.goto(f"{BASE_URL}/login")
            page.fill("input[name=email]", EMAIL)
            page.fill("input[name=password]", PASSWORD)
            page.click("button[type=submit]")
            page.wait_for_selector("text=Braucht Aufmerksamkeit")

        def dashboard_before() -> None:
            expect(page.get_by_text("Kritisch", exact=True).first).to_be_visible()
            state["critical_before"] = stat(page, "Kritische Pflichtkriterien")
            state["stale_before"] = stat(page, "Veraltet")
            assert state["critical_before"] == 2, f"kritische Pflichtkriterien: {state['critical_before']}"
            assert state["stale_before"] == 2, f"veraltet: {state['stale_before']}"
            expect(page.get_by_text("Kriterien erfüllt")).to_be_visible()
            shot(page, "01-dashboard-vorher")

        def action_center() -> None:
            assert action_row_present(page), "Eintrag «Nachweis veraltet» fuer 7.3.10 fehlt"
            page.get_by_text("Braucht Aufmerksamkeit").first.scroll_into_view_if_needed()
            shot(page, "02-action-center")

        def open_criterion() -> None:
            page.goto(f"{BASE_URL}/criteria/{CRITERION}")
            page.wait_for_selector("text=Hygienekonzept (Demo)")
            expect(page.get_by_role("cell", name="Veraltet").first).to_be_visible()
            shot(page, "03-kriterium-nachweis-veraltet")

        def upload_version() -> None:
            page.get_by_text("Neue Version hochladen", exact=True).first.click()
            form = page.locator("form").filter(has=page.locator("input[name=documentId]"))
            form.locator("input[type=file]").set_input_files(str(pdf_path))
            form.locator("input[name=validUntil]").fill(future)
            form.get_by_role("button", name="Neue Version hochladen").click()
            page.wait_for_selector("text=Neue Version gespeichert.")

        def version_list() -> None:
            page.reload()
            page.wait_for_selector("text=Hygienekonzept (Demo)")
            row = page.get_by_role("row").filter(has_text="Hygienekonzept (Demo)").first
            expect(row).to_contain_text("V2")
            expect(row).to_contain_text("Aktuell")
            page.get_by_text("Versionen anzeigen", exact=True).first.click()
            expect(page.get_by_text("(neueste)")).to_be_visible()
            expect(page.get_by_text("(ersetzt)")).to_be_visible()
            expect(page.get_by_text("Ein aktueller Nachweis liegt vor.")).to_be_visible()
            shot(page, "04-version-liste")

        def history() -> None:
            hist = page.locator("section[aria-labelledby=history-heading]")
            expect(hist).to_contain_text("Neue Version 2 von «Hygienekonzept (Demo)»")
            expect(hist).to_contain_text("Demo owner")
            hist.scroll_into_view_if_needed()
            shot(page, "05-verlauf")

        def dashboard_after_upload() -> None:
            page.goto(f"{BASE_URL}/")
            page.wait_for_selector("text=Braucht Aufmerksamkeit")
            expect(page.get_by_text("Kritisch", exact=True).first).to_be_visible()
            assert stat(page, "Kritische Pflichtkriterien") == 2, "Readiness hat sich durch Upload veraendert"
            assert stat(page, "Veraltet") == 1, "Veraltet sollte auf 1 sinken"
            assert not action_row_present(page), "Eintrag «Nachweis veraltet» fuer 7.3.10 ist noch da"
            shot(page, "06-dashboard-nach-upload")

        def set_met() -> None:
            page.goto(f"{BASE_URL}/criteria/{CRITERION}")
            page.wait_for_selector("select[name=status]")
            page.select_option("select[name=status]", label="Erfüllt")
            page.get_by_role("button", name="Speichern", exact=True).click()
            page.wait_for_selector("[role=status]:not(:empty)")
            page.reload()
            page.wait_for_selector("text=Hygienekonzept (Demo)")
            hist = page.locator("section[aria-labelledby=history-heading]")
            expect(hist).to_contain_text("Stand von «Kritisch» zu «Erfüllt»")
            shot(page, "07-kriterium-erfuellt")

        def dashboard_final() -> None:
            page.goto(f"{BASE_URL}/")
            page.wait_for_selector("text=Braucht Aufmerksamkeit")
            assert stat(page, "Kritische Pflichtkriterien") == 1, "Kritische Pflichtkriterien sollten auf 1 sinken"
            shot(page, "08-dashboard-nachher")

        step("Login als Owner", login)
        step("Dashboard: Kritisch, Fortschritt getrennt, Veraltet 2, kritisch 2", dashboard_before)
        step("Action Center: Nachweis veraltet fuer 7.3.10", action_center)
        step("Kriterium 7.3.10 zeigt den veralteten Nachweis", open_criterion)
        step("Neue Version mit Ablaufdatum in der Zukunft hochladen", upload_version)
        step("V2 aktuell, V1 ersetzt aber vorhanden, Hinweis sichtbar", version_list)
        step("Verlauf zeigt Upload und neue Version (Owner)", history)
        step("Dashboard: Eintrag weg, Veraltet 1, Readiness unveraendert", dashboard_after_upload)
        step("Stand bewusst auf «Erfüllt» setzen, Verlauf zeigt Statuswechsel", set_met)
        step("Dashboard: kritische Pflichtkriterien 2 -> 1", dashboard_final)
        browser.close()

    if failures:
        print(f"\n{len(failures)} Schritt(e) fehlgeschlagen. Die Daten wurden veraendert: neu seeden.")
        return 1
    print("\nAlle Schritte bestanden. Die Daten wurden veraendert: pnpm seed:demo -- --yes-reset")
    return 0


if __name__ == "__main__":
    sys.exit(main())
