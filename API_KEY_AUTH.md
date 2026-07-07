# 🔐 API-Key-Authentifizierung für den MCP-Gantt-Server

Einfache Shared-Secret-Authentifizierung für den `POST /mcp`-Endpunkt — gedacht
für schnelle Tests mit **Microsoft Copilot Studio** und anderen MCP-Clients.

> **Kein OAuth, kein Entra ID, keine Benutzeranmeldung.** Nur ein einzelner
> geheimer API-Key, hinterlegt als Umgebungsvariable `MCP_API_KEY`.

---

# Architektur

Der Server ist ein Node.js/Express-Server ([src/web/app.ts](src/web/app.ts)) mit
einem handgeschriebenen JSON-RPC-Endpunkt unter `POST /mcp`. Die
Authentifizierung ist eine schmale Express-**Middleware**, die genau vor diesem
einen Handler eingehängt wird:

```
Request ──▶ express.json()  ──▶ requireApiKey  ──▶ /mcp-Handler (initialize / tools/list / tools/call)
                                     │
                                     └─▶ 401, wenn Key fehlt oder falsch
```

**Bewusst NICHT geschützt** (bleiben öffentlich):

| Endpunkt | Grund |
|---|---|
| `GET /gantt-image/:id.png` | MCP-Clients (z.B. Copilot, Perplexity) laden das generierte Bild per `<img>`/Fetch **ohne** Auth-Header nach. Ein Schutz würde die Bildanzeige brechen. Die IDs sind zufällige UUIDs (nicht erratbar). |
| `GET /health` | Health-Check für Monitoring/Render.com. |
| `POST /api/gantt`, `/api/validate`, `GET /api/examples` | Lokale Web-Test-UI. |
| `/` (statische UI) | Lokale Browser-Testseite. |

Nur `POST /mcp` — die von externen Clients aufgerufene Tool-Schnittstelle —
verlangt den Key.

Betroffene / neue Dateien:

- [src/middleware/auth.ts](src/middleware/auth.ts) — die `requireApiKey`-Middleware **(neu)**
- [src/web/app.ts](src/web/app.ts) — `dotenv`-Import, Fail-Fast-Check, Einhängen der Middleware
- [.env.example](.env.example) — Vorlage für die Umgebungsvariablen **(neu)**

---

# Authentifizierungskonzept

1. **Shared Secret.** Ein einziger Key in `MCP_API_KEY`. Server und Client kennen
   ihn; der Client schickt ihn bei jedem Request mit.

2. **Zwei akzeptierte Header** (der Client wählt einen):
   - `Authorization: Bearer <key>`
   - `x-api-key: <key>`  ← in Copilot Studio meist am einfachsten

3. **Fail closed beim Start.** Ist `MCP_API_KEY` nicht gesetzt, bricht der Server
   beim Start mit `process.exit(1)` ab. So läuft der Endpunkt niemals versehentlich
   ungeschützt.

4. **Constant-time-Vergleich.** Der Vergleich nutzt `crypto.timingSafeEqual`, damit
   der Key nicht über Laufzeitunterschiede zeichenweise erraten werden kann.

5. **Generische 401.** Fehlender und falscher Key liefern dieselbe Antwort — keine
   Unterscheidung, die Enumeration erleichtern würde. Der Key-Wert wird nie geloggt.

---

# Implementierung

### `src/middleware/auth.ts` (neu)

Die Middleware liest den erwarteten Key aus `process.env.MCP_API_KEY`, extrahiert
den gesendeten Key aus `x-api-key` **oder** `Authorization: Bearer …`, und
vergleicht beide in konstanter Zeit. Bei Mismatch: HTTP 401 im JSON-RPC-Format.

```ts
import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

function extractApiKey(req: Request): string | null {
  const headerKey = req.header('x-api-key');
  if (headerKey && headerKey.length > 0) return headerKey;

  const authHeader = req.header('authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  return null;
}

function safeCompare(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false; // timingSafeEqual wirft bei Längen-Mismatch
  return timingSafeEqual(a, b);
}

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const expectedKey = process.env.MCP_API_KEY;
  if (!expectedKey) {
    res.status(500).json({
      jsonrpc: '2.0', id: req.body?.id ?? null,
      error: { code: -32603, message: 'Server misconfiguration' },
    });
    return;
  }

  const providedKey = extractApiKey(req);
  if (!providedKey || !safeCompare(providedKey, expectedKey)) {
    console.warn(`[Auth] Unauthorized request to ${req.path} from ${req.ip}`);
    res.status(401).json({
      jsonrpc: '2.0', id: req.body?.id ?? null,
      error: { code: -32001, message: 'Unauthorized: invalid or missing API key' },
    });
    return;
  }

  next();
}
```

### Einbindung in `src/web/app.ts`

```ts
import 'dotenv/config';                          // ganz oben: lädt .env in process.env
import { requireApiKey } from '../middleware/auth.js';

// Fail closed: ohne Key gar nicht erst starten
if (!process.env.MCP_API_KEY) {
  console.error('❌ FATAL: MCP_API_KEY ist nicht gesetzt.');
  process.exit(1);
}

// Middleware genau vor dem /mcp-Handler:
app.post('/mcp', requireApiKey, async (req, res) => { /* … bestehender Handler … */ });
```

---

# Vollständiger Code

Die lauffähige Implementierung dieses (Node.js-)Projekts steht oben und in
[src/middleware/auth.ts](src/middleware/auth.ts). Die folgenden Snippets sind
**Referenz** für andere Stacks — sie sind **nicht Teil dieses Repos**, zeigen aber
dasselbe Konzept, falls der Server einmal in Python portiert wird.

### Referenz A — Python FastAPI

```python
# app.py  (REFERENZ — nicht Teil dieses Node-Projekts)
import os, secrets
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader

app = FastAPI()
MCP_API_KEY = os.environ["MCP_API_KEY"]  # KeyError beim Start = fail closed

api_key_header = APIKeyHeader(name="x-api-key", auto_error=False)

def require_api_key(provided: str | None = Security(api_key_header)):
    # secrets.compare_digest = constant-time
    if not provided or not secrets.compare_digest(provided, MCP_API_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized: invalid or missing API key")

@app.post("/mcp", dependencies=[Depends(require_api_key)])
async def mcp_endpoint(payload: dict):
    ...  # JSON-RPC handling
```

### Referenz B — Python MCP SDK (Streamable HTTP)

```python
# server.py  (REFERENZ — nicht Teil dieses Node-Projekts)
import os, secrets
from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from mcp.server.fastmcp import FastMCP

MCP_API_KEY = os.environ["MCP_API_KEY"]
mcp = FastMCP("gantt")

@mcp.tool()
def create_gantt_diagram(tasks: list, options: dict | None = None) -> str:
    ...

class ApiKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.url.path == "/mcp":
            provided = request.headers.get("x-api-key") or ""
            if not secrets.compare_digest(provided, MCP_API_KEY):
                return JSONResponse(
                    {"jsonrpc": "2.0", "id": None,
                     "error": {"code": -32001, "message": "Unauthorized"}},
                    status_code=401,
                )
        return await call_next(request)

app = mcp.streamable_http_app()
app.add_middleware(ApiKeyMiddleware)
```

### Node.js MCP Server — aktiv in diesem Repo

Siehe oben: [src/middleware/auth.ts](src/middleware/auth.ts) +
`app.post('/mcp', requireApiKey, …)` in [src/web/app.ts](src/web/app.ts).

---

# Beispiel-Requests

`MCP_API_KEY` sei z.B. `sk_test_abc123…`. Der Server läuft auf `http://localhost:3000`.

### ✅ Erfolgreich (gültiger Key)

```bash
curl -i -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_test_abc123..." \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

```
HTTP/1.1 200 OK
{"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"create_gantt_diagram", ...}]}}
```

Alternativ mit Bearer-Header:

```bash
curl -i -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_abc123..." \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### ❌ Ohne API-Key → 401

```bash
curl -i -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

```
HTTP/1.1 401 Unauthorized
{"jsonrpc":"2.0","id":1,"error":{"code":-32001,"message":"Unauthorized: invalid or missing API key"}}
```

### ❌ Falscher API-Key → 401

```bash
curl -i -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: falscher-key" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

```
HTTP/1.1 401 Unauthorized
{"jsonrpc":"2.0","id":1,"error":{"code":-32001,"message":"Unauthorized: invalid or missing API key"}}
```

---

# .env

Kopiere [.env.example](.env.example) nach `.env` und trage einen echten Key ein.
Die `.env` ist bereits über `.gitignore` ausgeschlossen und darf nie committet werden.

```dotenv
# Sicheren Key erzeugen mit:  openssl rand -hex 32
MCP_API_KEY=dein-geheimer-64-zeichen-key
PORT=3000
SERVER_URL=http://localhost:3000
```

---

# README / Installation

```bash
# 1. Dependencies installieren
npm install

# 2. .env anlegen und Key setzen
cp .env.example .env
#   dann MCP_API_KEY in .env eintragen, z.B.:
#   MCP_API_KEY=$(openssl rand -hex 32)

# 3. Dev-Server starten (Hot Reload auf :3000)
npm run dev
#   ODER: Production-Build
npm run build && npm start
```

Der Server bricht mit einer Fehlermeldung ab, wenn `MCP_API_KEY` fehlt — das ist
gewolltes Verhalten (fail closed).

**In der Cloud (Render.com etc.):** `MCP_API_KEY` und `SERVER_URL` als
Environment-Variablen im Dashboard hinterlegen — **nicht** in eine committete
Datei schreiben. `SERVER_URL` muss die echte öffentliche HTTPS-URL sein.

---

# API-Key in Copilot Studio / MCP-Client hinterlegen

### Microsoft Copilot Studio (Custom Connector / MCP)

1. Beim Anlegen des Connectors als **Authentication type** → **API Key** wählen.
2. **Parameter label**: z.B. `API Key`
3. **Parameter name**: `x-api-key`
4. **Parameter location**: **Header**
5. Beim Verbinden den geheimen Key-Wert (aus `MCP_API_KEY`) eintragen. Copilot
   Studio speichert ihn als Secret und sendet ihn automatisch bei jedem Request.

> Alternativ, falls „Bearer" bevorzugt wird: Parameter name `Authorization`,
> Wert `Bearer <key>`.

### Generischer MCP-Client (JSON-Konfiguration)

Viele MCP-Clients erlauben Custom-Header pro Server:

```json
{
  "mcpServers": {
    "gantt": {
      "url": "https://dein-server.example.com/mcp",
      "headers": { "x-api-key": "dein-geheimer-key" }
    }
  }
}
```

---

# Sicherheitsprüfung

| Aspekt | Status | Umsetzung |
|---|---|---|
| Key nie im Quellcode | ✅ | Nur `process.env.MCP_API_KEY`; `.env` in `.gitignore`. |
| Fail closed | ✅ | `process.exit(1)`, wenn Key beim Start fehlt. |
| Timing-Angriffe | ✅ | `crypto.timingSafeEqual` (constant-time). |
| Key-Enumeration | ✅ | Generische 401, keine „fehlt vs. falsch"-Unterscheidung. |
| Key-Leak über Logs | ✅ | Key-Wert wird nie geloggt (nur Pfad/IP bei Ablehnung). |
| Transportverschlüsselung | ⚠️ | **HTTPS erzwingen.** Key nie über `http://` senden (außer localhost). Render/Cloud terminiert TLS — nur die HTTPS-URL verwenden. |
| Key-Rotation | ⚠️ | Bei Verdacht neuen Key generieren, Env-Var + Client aktualisieren, alten Wert entwerten. |
| Kein Key in URL/Query | ✅ | Nur Header, nie Query-Param (Query landet in Zugriffs-Logs/Referrern). |

### Bewusste Grenzen dieses „einfachen" Ansatzes

- **Kein Rate-Limiting / Brute-Force-Schutz.** Für den Produktivbetrieb empfiehlt
  sich z.B. `express-rate-limit` vor `/mcp`. Bei ausreichend langem Zufalls-Key
  (≥ 32 Bytes) ist Brute-Force praktisch aussichtslos, aber Rate-Limiting bremst
  Missbrauch und schützt Ressourcen.
- **Ein einziger geteilter Key** — keine Pro-Client-Keys, kein Widerruf einzelner
  Clients ohne globale Rotation. Ausreichend für Test-/Einzelnutzer-Szenarien,
  für Multi-Tenant später auf Key-Store/OAuth erweitern.
- **`/gantt-image/:id.png` ist öffentlich** (nötig für die Bildanzeige). Die IDs
  sind zufällige UUIDs; es liegen keine sensiblen Daten in den Bildern, die nicht
  ohnehin der aufrufende Client erzeugt hat.
