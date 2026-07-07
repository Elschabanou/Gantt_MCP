# 10 – Technische Dokumentation

**Service:** MCP Gantt Server · **Version:** 1.0.0 · **Stand:** 2026-07-07

---

## 1. Technologie-Stack

- **Runtime:** Node.js (ESM, `"type": "module"`, NodeNext-Auflösung)
- **Framework:** Express 5
- **Sprache:** TypeScript 5 (strict), Build via `tsc` → `dist/`
- **Rendering:** eigener SVG-String-Generator → `sharp` (PNG-Rasterung)
- **Validierung:** `zod`
- **Config:** `dotenv`
- **Container:** Multi-Stage `Dockerfile`, Port 3000 (lokal) / 10000 (Render)

## 2. Projektstruktur (relevant)

```
src/
  index.ts                  # importiert nur web/app.ts (kein stdio-Transport)
  web/app.ts                # Express-App + hand-gerollter /mcp JSON-RPC-Handler (LIVE)
  middleware/auth.ts        # requireApiKey (API-Key-Auth)
  register-fonts.ts         # muss zuerst importiert werden (Fontconfig vor sharp)
  utils/
    task-validator.ts       # GanttValidator (semantische Prüfungen)
    dependency-checker.ts   # DependencyChecker (DFS-Zirkel, Kahn-Topo-Sort)
    svg-generator.ts        # SVG-String-Erzeugung
    png-generator.ts        # SVG → PNG (sharp)
    html-generator.ts       # nur für /api/gantt (Web-UI-Preview)
    fonts.ts                # Fontconfig-Setup
  tools/schemas.ts          # Zod CreateGanttToolSchema
  types.ts                  # GanttTask, GanttOptions
```

> **Wichtig (aus CLAUDE.md):** Der **live** MCP-Handler ist der inline-Code in
> `src/web/app.ts` (`app.post('/mcp', …)`). Eine frühere SDK-Variante
> (`src/mcp-server.ts`) wurde entfernt. Änderungen an Tool-Schema/-Verhalten immer
> in `app.ts` vornehmen.

## 3. Konfiguration (Umgebungsvariablen)

| Variable | Pflicht | Default | Zweck |
|---|---|---|---|
| `MCP_API_KEY` | **ja** | – (Start bricht sonst ab) | API-Key für `/mcp` |
| `PORT` | nein | 3000 | Listen-Port |
| `SERVER_URL` | empfohlen | `http://localhost:${PORT}` | Basis für Bild-URLs |
| `NODE_ENV` | nein | – | `development` = ausführlichere Fehler |

Vorlage: [../../.env.example](../../.env.example). Details Auth:
[../../API_KEY_AUTH.md](../../API_KEY_AUTH.md).

## 4. Build & Run

```bash
npm install
cp .env.example .env      # MCP_API_KEY setzen (openssl rand -hex 32)
npm run dev               # Hot-Reload auf :3000
# oder
npm run build && npm start
```

## 5. MCP-Protokoll

- Transport: **Streamable HTTP**, `POST /mcp`, JSON-RPC 2.0.
- Protokollversion: `2025-06-18`.
- Methoden: `initialize`, `tools/list`, `tools/call`, `notifications/*` (→ 202).
- Tool: `create_gantt_diagram` (Schema in `app.ts` inline **und** `tools/schemas.ts` —
  auf Konsistenz achten).

## 6. Bild-Auslieferung

PNGs werden in einer In-Memory-`Map` (`imageCache`) unter `randomUUID()` gehalten
und unter `GET /gantt-image/:id.png` ausgeliefert. Pruning bei > 10 Einträgen;
kein Persistenz-Layer; Verlust bei Neustart. `SERVER_URL` muss die öffentliche
URL sein, sonst zeigen Links auf `localhost`.

## 7. Bekannte Altlasten / Cleanup-Kandidaten

- `jose` in `package.json`, aber ungenutzt.
- README/COPILOT_INTEGRATION*-Dokumente beschreiben teils veraltetes Frappe-Gantt/
  stdio-Design (siehe CLAUDE.md) — nicht als Wahrheit für aktuellen Code nehmen.
- Doppelte Tool-Schema-Definition (inline in `app.ts` + `tools/schemas.ts`) → Drift-Risiko.

## 8. Offene technische ToDos (verweist auf Sicherheits-/Betriebskonzept)

1. **Log-Redaction** des Header-Dumps in `app.ts` (Auth-Header nicht loggen). — **MUSS**
2. **Rate-Limiting** + `express.json({ limit })` + Task-/Bildgröße-Limits. — **MUSS**
3. **helmet** + non-root-Container. — SOLLTE
4. **CI**: Build + `npm audit` + (künftig) Tests; Freigabe-Gate vor Deploy. — MUSS/SOLLTE
5. **OAuth/Entra-ID**-Auth als Alternative zum Shared Key. — MUSS (Enterprise)
6. **Strukturiertes Logging** (pino) + Request-ID. — SOLLTE
7. Tool-Schema deduplizieren. — OPTIONAL

## 9. Deployment

- `render.yaml`: `buildCommand: npm install && npm run build`, `startCommand: npm start`,
  `autoDeploy: true` von `main`. Env-Vars `MCP_API_KEY`/`SERVER_URL` als `sync: false`
  (im Render-Dashboard zu setzen).
- `Dockerfile`: Multi-Stage (Build → schlankes Runtime-Image), `/health`-Check, Port 3000.
