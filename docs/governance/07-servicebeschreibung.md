# 07 – Servicebeschreibung

**Service:** MCP Gantt Server · **Version:** 1.0.0 · **Stand:** 2026-07-07

---

## 1. Kurzbeschreibung

Der MCP Gantt Server stellt über das Model Context Protocol (MCP) ein einzelnes
Werkzeug bereit, das aus strukturierten Aufgaben-/Projektdaten ein
**Gantt-Diagramm als PNG-Bild** erzeugt. Er ist für die Einbindung in KI-Assistenten
(z.B. Microsoft Copilot Studio) konzipiert: Der Assistent ruft das Tool auf,
erhält eine Bild-URL zurück und zeigt das Diagramm im Chat an.

## 2. Leistungsumfang

- **Tool `create_gantt_diagram`**: Eingabe = Liste von Tasks (`id`, `name`,
  `start`, `end`, optional `resource`, `group`, `dependencies`, `milestone`,
  `priority`, `progress`) plus Optionen (`title`, `view_mode` …). Ausgabe = PNG-Bild.
- **Validierung**: Datumslogik, Pflichtfelder, Duplikate, Ressourcen-Kapazität,
  **Zirkel-Dependency-Erkennung**.
- **Auslieferung**: Bild über kurzlebige, öffentliche URL (`/gantt-image/:id.png`).

## 3. Nicht enthalten (Scope-Abgrenzung)

- Keine Speicherung/Historie von Diagrammen.
- Keine Bearbeitung/Interaktivität (statisches PNG).
- Keine Anbindung an externe Datenquellen (Nutzer liefert alle Daten im Request).
- Keine Mehrmandantenfähigkeit / Nutzerverwaltung.

## 4. Zielgruppe & Anwendungsfälle

Projektleitende und Teams, die im KI-Assistenten schnell eine visuelle Zeitplanung
erzeugen möchten (z.B. „Erstelle mir ein Gantt für diese 5 Arbeitspakete").

## 5. Schnittstellen

| Endpoint | Methode | Auth | Zweck |
|---|---|---|---|
| `/mcp` | POST | **API-Key** | MCP JSON-RPC (initialize/tools/list/tools/call) |
| `/gantt-image/:id.png` | GET | keine | Bildauslieferung |
| `/health` | GET | keine | Health-Check |
| `/api/gantt`, `/api/validate`, `/api/examples`, `/` | – | keine | Lokale Test-Web-UI |

## 6. Betriebsdaten

- **Technologie:** Node.js, Express, TypeScript, `sharp` (Rendering).
- **Hosting:** Render.com (Ist: Free/US; Ziel: EU/Bezahlplan).
- **Verfügbarkeit:** aktuell **kein SLA** (siehe Betriebskonzept).
- **Kosten:** aktuell Free-Tier; Produktivbetrieb erfordert Bezahlplan.

## 7. Abhängigkeiten

Externe Runtime-Abhängigkeit nur zum Hosting-Provider. Keine externen APIs zur
Laufzeit. Node-Dependencies: `express`, `sharp`, `zod`, `dotenv` (+ ungenutzte
Altlasten `jose`, ggf. `puppeteer`/`frappe-gantt` in Doku — siehe technische Doku).

## 8. Reifegrad

**Proof-of-Concept.** Funktional lauffähig, aber ohne die für Produktiv-/Enterprise-
Betrieb nötigen Eigenschaften (föderierte Auth, SLA, Monitoring, EU-Hosting, formale
Ownership). Siehe [05-risikoanalyse.md](05-risikoanalyse.md) und
[06-whitelisting-fragebogen.md](06-whitelisting-fragebogen.md).
