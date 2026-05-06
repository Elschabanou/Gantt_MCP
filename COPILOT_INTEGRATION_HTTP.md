# MCP Gantt Server - Copilot Integration (HTTP)

Diese Anleitung beschreibt die Integration mit Microsoft Copilot über HTTP für cloud-gehostete Instanzen.

## 🌐 Für Cloud-Deployment (HTTP)

### 1. Server deployen

Der MCP Gantt Server ist für cloud-Deployment vorbereitet:

**Render.com (empfohlen):**

```bash
# 1. Repository zu GitHub pushen
git push origin main

# 2. Bei Render.com anmelden
# https://dashboard.render.com

# 3. "New +" → "Web Service"
# Repository: <dein-repo>
# Runtime: Node
# Build: npm install && npm run build
# Start: npm start
# Environment: PORT=3000
```

**Heroku:**

```bash
git push heroku main
```

**AWS/andere:**

```bash
docker build -t mcp-gantt:latest .
docker run -p 3000:3000 mcp-gantt:latest
```

### 2. Endpoint-URL ermitteln

Nach Deployment notieren Sie die öffentliche URL:

- Render: `https://mcp-gantt-xxxx.onrender.com`
- Heroku: `https://mcp-gantt-xxxx.herokuapp.com`
- AWS: `https://your-api-gateway.amazonaws.com`

### 3. Copilot konfigurieren (HTTP)

#### **Windows:**

```
Pfad: %APPDATA%\Code\User\globalStorage\GitHub.copilot-chat\cmp\settings.json
```

Alternativ: Neumeldung oder neu anlegen

```json
{
  "mcpServers": {
    "mcp-gantt-http": {
      "url": "http://localhost:3000/mcp",
      "type": "http"
    }
  }
}
```

#### **Für produktiv-gehostete URL:**

```json
{
  "mcpServers": {
    "mcp-gantt-prod": {
      "url": "https://mcp-gantt-production.onrender.com/mcp",
      "type": "http"
    }
  }
}
```

#### **macOS/Linux:**

```
~/.config/Code/User/globalStorage/GitHub.copilot-chat/cmp/settings.json
```

### 4. Copilot neustarten

- Fenster schließen/öffnen oder VS Code restarten
- Oder: `Cmd/Ctrl + Shift + P` → "Reload Window"

### 5. Testen

Schreiben Sie einen Prompt:

```
Create a Gantt diagram with these tasks:
- Task 1: Planning from 2024-01-01 to 2024-01-05
- Task 2: Design from 2024-01-06 to 2024-01-15, depends on Task 1
- Task 3: Development from 2024-01-16 to 2024-02-15, depends on Task 2
```

## 🔧 HTTP Endpoint Spezifikation

### POST /mcp

Akzeptiert JSON-RPC 2.0 Requests:

**tools/list Request:**

```bash
curl -X POST https://your-server.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

**tools/list Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "create_gantt_diagram",
        "description": "...",
        "inputSchema": { ... }
      }
    ]
  }
}
```

**tools/call Request:**

```bash
curl -X POST https://your-server.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "create_gantt_diagram",
      "arguments": {
        "tasks": [
          {
            "id": "t1",
            "name": "Planning",
            "start": "2024-01-01",
            "end": "2024-01-05"
          }
        ]
      }
    }
  }'
```

**tools/call Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "isError": false,
    "content": [
      {
        "type": "text",
        "text": "✅ Gantt diagram generated successfully!..."
      },
      {
        "type": "text",
        "image": {"mimeType": "image/png", "data": "<base64-encoded PNG>"}
      }
    ]
  }
}
```

### GET /health

Health-Check für Monitoring:

```bash
curl https://your-server.com/health
# { "status": "ok", "message": "MCP Gantt Server is running", "timestamp": "..." }
```

## 🌍 Alternative: Lokales HTTP für Development

Auch während der Entwicklung können Sie HTTP statt stdio nutzen:

```json
{
  "mcpServers": {
    "mcp-gantt-dev": {
      "url": "http://localhost:3000/mcp",
      "type": "http"
    }
  }
}
```

Starten Sie den Dev-Server:

```bash
npm run dev
# 🚀 Server running at http://localhost:3000
```

## 🔐 Sicherheit für Production

### HTTPS erzwingen

Alle cloud-Provider unterstützen automatisch HTTPS (Render, Heroku, AWS).

### Authentifizierung (optional)

Für private Server können Sie Basic Auth hinzufügen:

```typescript
// In src/web/app.ts
const basicAuth = require("express-basic-auth");
app.use(
  "/mcp",
  basicAuth({
    users: {user: process.env.MCP_PASSWORD},
    challenge: true,
  }),
);
```

Dann in Copilot settings:

```json
{
  "url": "https://user:password@your-server.com/mcp"
}
```

### CORS Headers (falls benötigt)

```typescript
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, GET");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});
```

## ⚠️ Debugging

### MCP Inspector

```bash
# Vom VS Code Extensions Marketplace installieren:
# "MCP Inspector" von Ianwazir
```

Damit können Sie JSON-RPC Requests und Responses live debuggen.

### Logs überprüfen

```bash
# Render
render logs --tail 100

# Heroku
heroku logs --tail

# Docker
docker logs -f container-id
```

### Typische Fehler

| Fehler               | Lösung                             |
| -------------------- | ---------------------------------- |
| "Connection refused" | Server läuft nicht / falsche URL   |
| "Invalid JSON"       | Fehler im JSON-RPC Format          |
| "Tool not found"     | Tool-Name falsch geschrieben       |
| "Validation failed"  | Task-Daten ungültig (Daten prüfen) |

## 📝 Beispiel-Prompts für Copilot

```
Erstelle ein Gantt-Diagramm für ein Software-Projekt mit:
- Anforderungsanalyse: 5 Tage
- Design: 10 Tage (nach Anforderungen)
- Implementierung: 20 Tage (nach Design)
- Testing: 10 Tage (nach Implementierung)
- Deployment: 2 Tage (nach Testing)

Verwende die create_gantt_diagram Tool.
```

## 🚀 Nächste Schritte

1. **Docker Image erstellen** (für schnelleres Cloud-Deployment)

   ```bash
   docker build -t mcp-gantt:latest .
   docker run -p 3000:3000 mcp-gantt:latest
   ```

2. **GitHub Actions für CI/CD** einrichten

3. **Monitoring** für Production (Sentry, DataDog, etc.)

4. **Custom Authentifizierung** für Unternehmensumgebungen
