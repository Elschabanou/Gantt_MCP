# 06 – Copilot Studio Whitelisting-Fragebogen

**Service:** MCP Gantt Server · **Stand:** 2026-07-07

Ausfüll-Vorlage für den organisationsinternen Freigabe-/Whitelist-Prozess.
Antworten spiegeln den **Ist-Zustand** wider; offene Punkte sind markiert.

---

## A. Allgemein

| Frage | Antwort |
|---|---|
| Servicename | MCP Gantt Server |
| Zweck | Gantt-Diagramm-Generierung (PNG) aus Task-Listen via MCP |
| Anzahl exponierter Tools | 1 (`create_gantt_diagram`) |
| Endpoint | `https://<host>/mcp` (Streamable HTTP, JSON-RPC 2.0) |
| Service Owner | _[eintragen]_ |
| Technischer Kontakt | _[eintragen]_ |
| Quellcode-Repo | _[URL eintragen]_ |

## B. Authentifizierung & Autorisierung

| Frage | Antwort | Status |
|---|---|---|
| Authentifizierungsverfahren? | API-Key (Header `x-api-key`/`Bearer`), shared secret | ⚠️ PoC-geeignet, für Enterprise Entra ID empfohlen |
| Unterstützt OAuth 2.0 / Entra ID? | Nein (geplant) | ❌ offen |
| Delegated Permissions? | Nein (kein Nutzerkontext) | ❌ offen |
| Least-Privilege-Scope? | Tool ohne FS-/Netz-/DB-Zugriff | ✔ |
| Key-Rotation definiert? | Prozess dokumentiert, Intervall _[eintragen]_ | ⚠️ |

## C. Datenverarbeitung & Datenschutz

| Frage | Antwort | Status |
|---|---|---|
| Werden personenbezogene Daten verarbeitet? | Möglich (`resource`, `name`, IP in Logs) | ⚠️ |
| Persistente Speicherung? | Nein (nur RAM, ~30 Min) | ✔ |
| Speicherort/Region? | Render, **US (Oregon)** | ❌ EU erforderlich |
| AVV/DPA vorhanden? | Nein | ❌ offen |
| DSFA/DPIA durchgeführt? | Vorbewertung liegt vor | ⚠️ |
| Datenweitergabe an Dritte? | Nur an aufrufenden MCP-Client (Bild-URL) | ✔ |

## D. Sicherheit

| Frage | Antwort | Status |
|---|---|---|
| TLS/HTTPS? | Ja (Render-Terminierung) | ✔ |
| Input-Validierung? | Ja (Zod + semantische Validierung) | ✔ |
| Rate-Limiting? | Nein | ❌ offen |
| Request-Size-Limit? | Nein | ❌ offen |
| Secrets im Code? | Nein (`env`, `.gitignore`) | ✔ |
| Logging ohne Secrets? | **Nein** – Header-Dump loggt Auth-Header | ❌ MUSS-Fix |
| Vulnerability-Scanning? | Nein | ❌ offen |
| Security-Header (helmet)? | Nein | ⚠️ |

## E. Betrieb & Verfügbarkeit

| Frage | Antwort | Status |
|---|---|---|
| SLA? | Nein (Free-Plan) | ❌ |
| Monitoring/Alerting? | Nur `/health`, kein Alerting | ❌ offen |
| Incident-Response-Prozess? | Minimalentwurf vorhanden | ⚠️ |
| Owner + Vertretung benannt? | Nein | ❌ offen |
| Deployment-Freigabe-Gate? | Nein (Auto-Deploy) | ❌ offen |
| Backup/Recovery? | Keine persistenten Daten; IaC im Repo | ✔ |

## F. MCP-spezifisch

| Frage | Antwort | Status |
|---|---|---|
| Anzahl/Umfang Tools minimal? | 1 deterministisches Tool | ✔ |
| Tool führt Code/Shell aus? | Nein | ✔ |
| Ausgehender Netzwerkzugriff? | Nein | ✔ |
| Prompt-Injection-Oberfläche? | Sehr gering (statischer Output) | ✔ |
| Kostenkontrolle/Limits? | Nein | ❌ offen |

## G. Freigabe-Empfehlung (Ausfüller)

- [ ] Alle **MUSS**-Punkte geschlossen
- [ ] DSB-Freigabe
- [ ] Security-Review bestanden
- [ ] Owner & Support benannt

**Reifegrad-Einschätzung (Selbstauskunft):** PoC / nicht produktionsreif.
Empfohlener Weg: erst MUSS-Gaps (Auth, EU-Hosting/AVV, Log-Redaction, Rate-Limit,
Owner, Monitoring) schließen, dann Freigabe beantragen.
