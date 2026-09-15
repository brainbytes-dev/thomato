"""Das Dossier einlesen. Laeuft auf dem Server, nicht auf einem Rechner.

Bis zum 15.09.2026 lag das Dossier auf Michaels Rechner, dieses Skript ging
es dort durch und die erzeugte JSON-Datei wurde in die Anwendung geladen.
Michael am 15.09.2026: «nichts soll auf dem rechner laufen, alles auf dem
proxmox, die dossiers müssen auch auf den proxmox verschoben werden.»

Das Dossier liegt jetzt unter /opt/ivr/IVR Dokumente. Was frueher hier
stand, steht in dossier.py; dort wird es auch von der Anwendung benutzt,
wenn jemand in den Einstellungen «Dossier neu einlesen» drueckt. Dieses
Skript ist nur noch der Weg ueber die Kommandozeile:

    su ivr -s /bin/sh -c "cd /opt/ivr/anwendung && \\
        /opt/ivr/venv/bin/python dossier-einlesen.py"
"""
import dossier

if __name__ == "__main__":
    ergebnis = dossier.neu_einlesen()
    print(f"{ergebnis['gelesen']} Dateien gelesen, "
          f"{ergebnis['zugeordnet']} einem Kriterium zugeordnet, "
          f"{ergebnis['belegte']} Kriterien belegt")
    print("Liste geschrieben nach", ergebnis["liste"])
    if ergebnis["unbekannt"]:
        print("\nOrdner mit einer Nummer, zu der es kein Kriterium gibt:")
        for u in ergebnis["unbekannt"]:
            print("  ", u)
