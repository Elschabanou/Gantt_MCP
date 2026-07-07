# 01 – Architekturdokument

**Service:** MCP Gantt Server
**Version:** 1.0.0
**Stand:** 2026-07-07
**Status:** Prototyp / Proof-of-Concept (noch nicht enterprise-freigegeben)
**Owner:** _[Service Owner eintragen]_ · **Autor:** _[Name]_

> Hinweis: Dieses Dokument beschreibt den **tatsächlichen** Ist-Zustand des Codes
> (Stand siehe oben), nicht einen Soll-Zustand. Gaps zum Enterprise-Zielbild sind
> als solche markiert und in [05-risikoanalyse.md](05-risikoanalyse.md) bewertet.

---

## 1. Zweck & Kontext

Der MCP Gantt Server ist ein **Single-Tool-MCP-Server**, der aus einer Liste von
Task-Objekten ein Gantt-Diagramm als PNG rendert. Er wird über HTTP (Streamable
HTTP, `POST /mcp`) von MCP-Clients wie Microsoft Copilot Studio aufgerufen. Es
gibt **keinen** stdio-Transport im Produktivbetrieb.

Einziges Tool: **`create_gantt_diagram`** — deterministisch, ohne Seiteneffekte
außerhalb des Prozessspeichers.

## 2. Systemarchitektur (Logisch)

```
┌──────────────────┐     HTTPS / JSON-RPC 2.0      ┌──────────────────────────┐
│  MCP-Client       │  POST /mcp  (x-api-key)       │   MCP Gantt Server        │
│  (Copilot Studio, │ ────────────────────────────▶ │   (Node.js / Express)     │
│   Perplexity …)   │                                │                           │
│                   │ ◀──────────────────────────── │  ┌─────────────────────┐  │
│                   │   JSON-RPC result (Markdown    │  │ requireApiKey (Auth)│  │
│                   │   mit Bild-URL)                │  └─────────┬───────────┘  │
│                   │                                │            ▼              │
│                   │   GET /gantt-image/:id.png     │  ┌─────────────────────┐  │
│                   │ ◀──────────────────────────── │  │ /mcp JSON-RPC Handler│  │
│                   │   (öffentlich, ohne Auth)      │  └─────────┬───────────┘  │
└──────────────────┘                                │            ▼              │
                                                     │  Zod-Schema-Validierung   │
                                                     │  GanttValidator (Semantik)│
                                                     │  DependencyChecker (DFS)  │
                                                     │  SVG-Generator → sharp    │
                                                     │  imageCache (In-Memory Map)│
                                                     └──────────────────────────┘
```

## 3. Komponentenübersicht

| Komponente | Datei | Verantwortung |
|---|---|---|
| HTTP/MCP-Endpunkt | `src/web/app.ts` | Express-App, hand-gerollter `/mcp` JSON-RPC-Handler (`initialize`, `tools/list`, `tools/call`), Web-/API-Routen |
| **Auth-Middleware** | `src/middleware/auth.ts` | API-Key-Prüfung (`x-api-key` / `Bearer`), timing-safe, fail-closed |
| Schema-Validierung | `src/tools/schemas.ts` | Zod-Schema `CreateGanttToolSchema` |
| Semantische Validierung | `src/utils/task-validator.ts` | Pflichtfelder, Datumslogik, Progress, Duplikate, Ressourcen-Kapazität |
| Dependency-Prüfung | `src/utils/dependency-checker.ts` | Existenz referenzierter IDs, Zirkel-Erkennung (DFS), Topo-Sort (Kahn) |
| Rendering | `src/utils/svg-generator.ts`, `src/utils/png-generator.ts` | SVG-String → PNG via `sharp` |
| Bild-Cache | `imageCache` in `app.ts` | In-Memory `Map`, UUID-Key, Pruning bei > 10 Einträgen |
| Fonts | `src/register-fonts.ts`, `src/utils/fonts.ts` | Registrierung der eingebetteten Schriftart für `sharp`/fontconfig |

**Abgrenzung – bewusst NICHT vorhanden:** keine Datenbank, kein Dateisystem-Schreibzugriff
(außer temp. Fontconfig), **kein ausgehender Netzwerkverkehr**, keine Shell-Ausführung,
kein Zugriff auf andere Systeme. Dies minimiert die Angriffsfläche erheblich (siehe MCP-Sicherheit).

## 4. Datenflüsse

1. Client sendet `tools/call` mit Task-JSON an `POST /mcp` (inkl. API-Key im Header).
2. Auth-Middleware prüft Key → 401 bei Mismatch.
3. Zod-Validierung → semantische Validierung → Dependency-Check.
4. Bei Erfolg: SVG→PNG-Rendering, PNG in `imageCache` unter zufälliger UUID.
5. Antwort enthält Markdown-Text + Bild-URL (`${SERVER_URL}/gantt-image/<uuid>.png`).
6. Client lädt das Bild via `GET /gantt-image/:id.png` (**ohne** Auth) nach.
7. PNG verbleibt max. ~30 Min im RAM, wird bei Cache-Überlauf (> 10) verdrängt, geht bei Neustart verloren.

**Datenklassifizierung des Payloads:** Task-Namen, Datumsangaben und optional
`resource` (Ressourcen-/Personennamen) — potenziell **personenbezogen**. Siehe
[03-datenschutzbewertung.md](03-datenschutzbewertung.md).

## 5. Netzwerktopologie & Hosting

| Aspekt | Ist-Zustand | Enterprise-Ziel (Gap) |
|---|---|---|
| Hosting | Render.com, Plan **free**, Region **Oregon (US)** | EU-Region + kostenpflichtiger Plan mit SLA |
| TLS | Von Render terminiert (HTTPS) | ✔ ausreichend, aber HSTS/Cert-Pinning prüfen |
| Netzsegmentierung | Öffentliches Internet, keine IP-Allowlist | Optional: IP-Allowlist / Private Networking |
| Ports | 3000 (lokal) / 10000 (Render), `/health`-Check | ✔ |
| Deploy | `autoDeploy: true` von `main` (Git-Push triggert Redeploy) | Kontrollierter Release-Prozess mit Freigabe-Gate |

## 6. Verantwortlichkeiten (RACI – auszufüllen)

| Rolle | Person | Aufgabe |
|---|---|---|
| Service Owner | _[eintragen]_ | Fachliche Verantwortung, Freigaben |
| Technischer Betreiber | _[eintragen]_ | Deployment, Betrieb, Incidents |
| Security-Verantwortlicher | _[eintragen]_ | Security-Reviews, Key-Rotation |
| Datenschutz | _[DSB eintragen]_ | DSGVO-Bewertung, DPIA |

> **Aktuelle Realität:** Ein-Personen-Projekt (studentische Arbeit) ohne formale
> Vertretung, On-Call oder 4-Augen-Prinzip. Für Enterprise-Freigabe ist das ein
> **Muss-Gap** (siehe Betriebskonzept & Governance).
