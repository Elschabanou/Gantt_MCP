# 📊 MCP Gantt Server

Ein vollständiger **Model Context Protocol (MCP) Server** zur Generierung interaktiver **Gantt-Diagramme** mit erweiterten Validierungen. Der Server nutzt [Frappe Gantt](https://frappe.io/gantt) und kann direkt mit **Microsoft Copilot** verbunden werden.

## ✨ Features

- ✅ **Strukturierte Task-Definition** mit JSON-Schema-Validierung
- ✅ **Erweiterte Validierungen**:
  - Datumsprüfung & Logik (start ≤ end)
  - **Zirkeldependency-Erkennung** (DFS-Algorithmus)
  - Ressourcen-Kapazitätsprüfung
  - Scheduling-Konflikte
- ✅ **PNG-Output** - Self-contained Gantt-Charts für Chat-Integration
- ✅ **Web-UI zum Testen** - Input-Formular + Live-Vorschau
- ✅ **MCP Server** - Mit stdio-Transport (lokal) oder HTTP
- ✅ **Frappe Gantt Integration** - Interactive Timeline mit Drag & Drop
- ✅ **TypeScript** mit vollständiger Typ-Sicherheit

## 🚀 Quickstart

### 1. Installation

```bash
# Repository klonen/öffnen
cd MCP_Gantt

# Dependencies installieren
npm install

# TypeScript kompilieren
npm run build
```

### 2. Web-UI testen (Development)

```bash
# Web-Server mit HTTP starten (http://localhost:3000)
npm run dev
```

Öffne http://localhost:3000 im Browser und teste mit den Beispielen!

### 3. Cloud-Deployment

Der MCP Gantt Server läuft auf einem **HTTP-basierenden Endpoint** (`POST /mcp`) und kann einfach in der Cloud deployed werden:

```bash
# Production Start
npm start
```

**Unterstützte Deployment-Plattformen:**
- ✅ **Render.com** (empfohlen, kostenlos)
- ✅ **Heroku**
- ✅ **AWS Lambda / API Gateway**
- ✅ **Docker Container** (jede Platform)

Siehe [COPILOT_INTEGRATION_HTTP.md](COPILOT_INTEGRATION_HTTP.md) für detaillierte Cloud-Deployment Anleitung.

### 4. Mit Copilot verbinden

Konfigurieren Sie den MCP Server in Copilot:

**Für lokale Entwicklung:**
```json
{
  "mcpServers": {
    "mcp-gantt": {
      "url": "http://localhost:3000/mcp",
      "type": "http"
    }
  }
}
```

**Für Cloud-Deployment:**
```json
{
  "mcpServers": {
    "mcp-gantt-prod": {
      "url": "https://your-server.onrender.com/mcp",
      "type": "http"
    }
  }
}
```

Dann können Sie in Copilot Gantt-Diagramme direkt erstellen!
```

## 📋 Task-Format

Alle Tasks müssen diesem Format entsprechen:

```json
{
  "tasks": [
    {
      "id": "1",
      "name": "Task Name",
      "start": "2024-01-01",
      "end": "2024-01-15",
      "progress": 50,
      "dependencies": "2,3",
      "priority": "high",
      "resource": "Developer1"
    }
  ],
  "options": {
    "view_mode": "Month"
  }
}
```

### Erforderliche Felder
- `id` (string) - Eindeutige Kennung
- `name` (string) - Task-Name
- `start` (YYYY-MM-DD) - Startdatum
- `end` (YYYY-MM-DD) - Enddatum

### Optionale Felder
- `progress` (0-100) - Fortschritt %
- `dependencies` (string) - Komma-getrennte Task-IDs (z.B. "1,2")
- `priority` (high|medium|low) - Priorität
- `resource` (string) - Ressourcen-/Person-Zuweisung
- `custom_class` (string) - CSS-Klasse

### Gantt-Optionen
- `view_mode` (Day|Week|Month|Year) - Timeline-Ansicht (default: Month)
- `bar_height` (number) - Höhe Task-Bar in px (default: 30)
- `column_width` (number) - Breite Timeline-Spalte (default: 45)
- `readonly` (boolean) - Alle Edits deaktivieren
- `today_button` (boolean) - Heute-Button anzeigen (default: true)
- `popup_on` (click|hover) - Popup-Trigger

## 🔗 API Endpoints (Web-UI)

### POST /api/gantt
**Generiert ein Gantt-Diagramm aus Tasks**

```bash
curl -X POST http://localhost:3000/api/gantt \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      {"id": "1", "name": "Task", "start": "2024-01-01", "end": "2024-01-15"}
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "taskCount": 1,
  "image": "<base64-encoded PNG>"
  "warnings": null
}
```

### POST /api/validate
**Validiert Tasks ohne Gantt zu generieren**

```bash
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d '{"tasks": [...]}'
```

### GET /api/examples
**Gibt Beispiel-Daten zurück** (simple, advanced, withDependencies)

```bash
curl http://localhost:3000/api/examples
```

### GET /health
**Gesundheitsprüfung**

```bash
curl http://localhost:3000/health
```

## 🤖 Mit Microsoft Copilot verbinden

Siehe [COPILOT_INTEGRATION_HTTP.md](COPILOT_INTEGRATION_HTTP.md) für ausführliche Anleitung!

## 🔍 Validierungschecks

Der Server führt automatisch folgende Checks durch:

### ✅ Basis-Checks
- ✓ Erforderliche Felder vorhanden
- ✓ Datumformat YYYY-MM-DD
- ✓ start ≤ end
- ✓ Progress 0-100
- ✓ Keine doppelten Task-IDs

### ✅ Abhängigkeiten
- ✓ **Zirkeldependencies erkannt** (DFS)
- ✓ Alle referenzierten Tasks existieren
- ✓ Topologische Sortierbarkeit

### ✅ Ressourcen & Kapazität
- ✓ Ressourcen-Überlagerungen
- ✓ Kapazitätsgrenzen

### ✅ Scheduling
- ✓ Tasks mit 100% Progress in Zukunft
- ✓ Unvollständige Tasks mit alten End-Dates

## 📂 Projektstruktur

```
MCP_Gantt/
├── src/
│   ├── index.ts                    # MCP Server-Entrypoint
│   ├── types.ts                    # TypeScript Interfaces
│   ├── tools/
│   │   ├── generate-gantt.ts       # Tool-Definition
│   │   └── schemas.ts              # Zod-Schemas
│   ├── utils/
│   │   ├── html-generator.ts       # Frappe Gantt HTML
│   │   ├── task-validator.ts       # Validator-Engine
│   │   └── dependency-checker.ts   # Zirkeldependency-Check (DFS)
│   └── web/
│       └── app.ts                  # Express Web-Server
├── public/
│   └── index.html                  # Web-UI
├── dist/                           # Kompiliert (nach npm run build)
├── package.json
├── tsconfig.json
└── README.md
```

## 🛠️ Entwicklung

### Build
```bash
npm run build
```

### Development (Web-UI mit Hot-Reload)
```bash
npm run dev
```

### Production Server
```bash
npm start
```

## 📝 Beispiele

### Einfaches Projekt (4 Tasks)

```json
{
  "tasks": [
    {"id": "1", "name": "Planung", "start": "2024-01-01", "end": "2024-01-05", "progress": 100},
    {"id": "2", "name": "Design", "start": "2024-01-05", "end": "2024-01-15", "progress": 80, "dependencies": "1"},
    {"id": "3", "name": "Entwicklung", "start": "2024-01-15", "end": "2024-02-01", "progress": 30, "dependencies": "2"},
    {"id": "4", "name": "Test", "start": "2024-02-01", "end": "2024-02-10", "progress": 0, "dependencies": "3"}
  ]
}
```

### Komplexes Projekt (mit Ressourcen & Prioritäten)

```json
{
  "tasks": [
    {
      "id": "planning",
      "name": "Project Planning",
      "start": "2024-01-01",
      "end": "2024-01-07",
      "progress": 100,
      "priority": "high",
      "resource": "PM"
    },
    {
      "id": "design",
      "name": "UI/UX Design",
      "start": "2024-01-07",
      "end": "2024-01-21",
      "progress": 70,
      "dependencies": "planning",
      "priority": "high",
      "resource": "Designer"
    },
    {
      "id": "backend",
      "name": "Backend Development",
      "start": "2024-01-14",
      "end": "2024-02-04",
      "progress": 40,
      "dependencies": "planning",
      "priority": "high",
      "resource": "Backend Dev"
    },
    {
      "id": "frontend",
      "name": "Frontend Development",
      "start": "2024-01-21",
      "end": "2024-02-04",
      "progress": 20,
      "dependencies": "design,backend",
      "priority": "medium",
      "resource": "Frontend Dev"
    },
    {
      "id": "integration",
      "name": "API Integration",
      "start": "2024-02-04",
      "end": "2024-02-11",
      "progress": 0,
      "dependencies": "backend,frontend",
      "priority": "high",
      "resource": "Full Stack"
    },
    {
      "id": "testing",
      "name": "QA Testing",
      "start": "2024-02-11",
      "end": "2024-02-18",
      "progress": 0,
      "dependencies": "integration",
      "priority": "medium",
      "resource": "QA"
    },
    {
      "id": "deployment",
      "name": "Deployment",
      "start": "2024-02-18",
      "end": "2024-02-20",
      "progress": 0,
      "dependencies": "testing",
      "priority": "high",
      "resource": "DevOps"
    }
  ],
  "options": {
    "view_mode": "Week",
    "bar_height": 35
  }
}
```

## ⚠️ Häufige Fehler

### "Circular dependency detected"
**Ursache:** Task hängt direkt oder indirekt von sich selbst ab.
```json
// ❌ Falsch
{"id": "1", "dependencies": "1"}  // Task hängt von sich selbst ab
{"id": "1", "dependencies": "2"}
{"id": "2", "dependencies": "1"}  // 1 → 2 → 1 (Kreis!)

// ✅ Richtig
{"id": "1", "dependencies": ""}
{"id": "2", "dependencies": "1"}
{"id": "3", "dependencies": "2"}
```

### "Start date must be before or equal to end date"
```json
// ❌ Falsch
{"id": "1", "start": "2024-12-31", "end": "2024-01-01"}

// ✅ Richtig
{"id": "1", "start": "2024-01-01", "end": "2024-12-31"}
```

### "Progress must be between 0 and 100"
```json
// ❌ Falsch
{"id": "1", "progress": 150}

// ✅ Richtig
{"id": "1", "progress": 50}
```

## 🔐 Sicherheit

- **Input-Validierung**: Alle Inputs werden mit Zod validiert
- **No External URLs**: HTML ist self-contained (keine remote Resources)
- **Type-Safe**: Vollständige TypeScript-Typisierung
- **Error Handling**: Aussagekräftige Fehlermeldungen

## 📚 Abhängigkeiten

- `@modelcontextprotocol/sdk` - MCP Protocol
- `frappe-gantt` - Gantt-Chart Visualisierung
- `express` - Web-Server
- `zod` - Schema-Validierung
- `typescript` - Typ-Sicherheit

## 🤝 Erweitern

### Eigenes Tool hinzufügen

1. Definiere das Tool in `src/tools/`:
```typescript
export function myCustomTool(): Tool {
  return {
    name: 'my_tool',
    description: 'Mein eigenes Tool',
    inputSchema: { /* ... */ }
  };
}
```

2. Registriere es in `src/index.ts`:
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [createGanttDiagramTool(), myCustomTool()],
  };
});
```

### HTTP-Transport statt stdio

```typescript
import { WebSocketServerTransport } from '@modelcontextprotocol/sdk/server/http.js';

const transport = new WebSocketServerTransport({
  port: 3001,
});
```

## 📄 Lizenz

ISC

## 🙋 Troubleshooting

### "Module not found" Fehler
```bash
npm install
npm run build
```

### Port 3000 belegt
```bash
PORT=3001 npm run dev
```

### MCP Server verbindet sich nicht
- Stelle sicher, dass der Pfad in `settings.json` korrekt ist
- Probiere den MCP Inspector: `npx @modelcontextprotocol/inspector node dist/index.js`

### Gantt-Diagramm zeigt sich nicht
- Überprüfe Browser-Konsole auf JavaScript-Fehler
- Stelle sicher, dass JavaScript aktiviert ist
- Probiere einen anderen Browser

## 📞 Support

Für Fragen oder Bugs: Öffne ein Issue oder Diskussion!

---

**Made with ❤️ for Project Planning** | Powered by Frappe Gantt & Model Context Protocol
