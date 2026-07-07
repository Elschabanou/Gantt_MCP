# Governance- & Enterprise-Readiness-Dokumentation

**Service:** MCP Gantt Server · **Stand:** 2026-07-07 · **Reifegrad: Proof-of-Concept**

Dieses Verzeichnis bündelt die Unterlagen zur Vorbereitung eines Enterprise-Security-
Reviews und einer Copilot-Studio-Whitelist-Freigabe. Alle Dokumente beschreiben den
**tatsächlichen Ist-Zustand** des Codes; noch nicht erfüllte Anforderungen sind als
Gap markiert. Platzhalter _[…]_ sind vom Owner auszufüllen.

## Inhalt

| # | Dokument | Inhalt |
|---|---|---|
| 01 | [Architektur](01-architektur.md) | System-, Komponenten-, Datenfluss-, Netz-/Hosting-Sicht |
| 02 | [Sicherheitskonzept](02-sicherheitskonzept.md) | AuthN/Z, API-Schutz, Secrets, Logging, Monitoring, IR |
| 03 | [Datenschutzbewertung](03-datenschutzbewertung.md) | DSGVO, Datenklassen, Drittland, Löschung |
| 04 | [Betriebskonzept](04-betriebskonzept.md) | Rollen, Deploy, Wartung, Backup/Recovery |
| 05 | [Risikoanalyse](05-risikoanalyse.md) | Risiken (W×A) + Gegenmaßnahmen + Prio |
| 06 | [Whitelisting-Fragebogen](06-whitelisting-fragebogen.md) | Ausfüllvorlage Freigabeprozess |
| 07 | [Servicebeschreibung](07-servicebeschreibung.md) | Leistungsumfang, Scope, Schnittstellen |
| 08 | [Supportkonzept](08-supportkonzept.md) | Kanäle, Reaktionszeiten, Incident-Handling |
| 09 | [Benutzerdokumentation](09-benutzerdokumentation.md) | Verbindung, Eingabeformat, FAQ |
| 10 | [Technische Dokumentation](10-technische-dokumentation.md) | Stack, Struktur, Config, ToDos |

Ergänzend: [../../API_KEY_AUTH.md](../../API_KEY_AUTH.md) (Auth-Details) und
[../../CLAUDE.md](../../CLAUDE.md) (Architektur-Notizen).

## Prio-Legende

- **MUSS** – Freigabe-Blocker, vor Whitelist zu schließen
- **SOLLTE** – erwartet, erhöht Freigabewahrscheinlichkeit deutlich
- **OPTIONAL** – Reifegrad/Zusatznutzen

## Top-MUSS-Gaps (Kurzüberblick)

1. **Secret-Leak in Logs** (Auth-Header-Dump in `app.ts`) entfernen.
2. **EU-Hosting + AVV** statt Render Free/US.
3. **Auth auf Entra ID / OAuth 2.0** heben (größter Whitelist-Hebel).
4. **Rate-Limiting + Request-Size-Limit** (Security/Kosten/Missbrauch).
5. **Owner + Vertretung** benennen; **Release-Gate/CI** statt Auto-Deploy.
6. **Monitoring/Alerting** + minimaler **Incident-Response-Prozess**.
