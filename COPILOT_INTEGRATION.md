# Microsoft Copilot Integration Guide

## Schnellstart: MCP Gantt Server mit Copilot verbinden

### Voraussetzungen
- VS Code mit GitHub Copilot installiert
- Node.js 16+
- MCP Gantt Server gebaut (`npm run build`)

### Schritt 1: Konfigurationsdatei finden/erstellen

Die MCP-Konfiguration befindet sich hier (je nach OS):

**Windows:**
```
C:\Users\<USERNAME>\AppData\Roaming\Code\User\globalStorage\GitHub.copilot\settings.json
```

**macOS:**
```
~/Library/Application Support/Code/User/globalStorage/GitHub.copilot/settings.json
```

**Linux:**
```
~/.config/Code/User/globalStorage/GitHub.copilot/settings.json
```

### Schritt 2: Konfiguration hinzufügen

Öffne die `settings.json` und füge folgende Konfiguration hinzu (falls kein `mcp.servers` Objekt existiert, erstelle es):

```json
{
  "mcp": {
    "servers": {
      "gantt": {
        "type": "stdio",
        "command": "node",
        "args": ["C:/Users/<USERNAME>/Programmieren/MCP_Gantt/dist/index.js"]
      }
    }
  }
}
```

**Windows-Pfade sollten mit `/` oder `\\` angegeben werden:**
```json
"args": ["C:/Users/felix/Programmieren/MCP_Gantt/dist/index.js"]
```

### Schritt 3: Copilot neu starten

Option A: VS Code vollständig neustarten
```bash
# VS Code schließen und wieder öffnen
```

Option B: Copilot Chat neustarten
- Öffne Command Palette: `Ctrl+Shift+P`
- Suche: "GitHub Copilot: Clear Session Storage"
- Enter drücken
- Copilot Chat neustarten

### Schritt 4: Tool verwenden!

Öffne den Copilot Chat und nutze das Tool:

```
@copilot Erstelle ein Gantt-Diagramm mit folgenden Tasks:
- Website Redesign: 2024-06-01 bis 2024-06-30, 50% Progress
- API Development: 2024-06-15 bis 2024-07-15, 30% Progress, hängt ab von Website Redesign
- Testing: 2024-07-15 bis 2024-07-25, 0% Progress
```

Copilot wird automatisch das Tool aufrufen und ein interaktives Gantt-Diagramm generieren! 📊

## Beispiel-Anfragen für Copilot

### Einfaches Projekt
```
@copilot create_gantt_diagram: Erstelle einen Projektplan für ein Software-Projekt mit:
- Setup (1 Woche, 100%), 
- Design (2 Wochen, 50%), 
- Entwicklung (4 Wochen, 0%)
Start: 2024-06-01
```

### Mit Abhängigkeiten
```
@copilot Ich plane ein Webprojekt. Backend-Entwicklung läuft parallel zum Frontend,
beide hängen vom Design ab. Testing kommt danach. Erstelle ein Gantt-Diagramm.
```

### Mit Ressourcen und Prioritäten
```
@copilot Erstelle einen Gantt für ein Kundenprojekt mit folgenden Ressourcen:
- Project Manager: Kickoff (high priority)
- Designer: UI Design (high priority) - hängt von Kickoff ab
- 2x Backend Dev: Backend API (high) - parallel zu Design
- 2x Frontend Dev: Frontend (medium) - nach Backend und Design
- QA: Testing (medium) - nach Frontend
```

### Rückwärts aus Deadline
```
@copilot Der Projektstart ist 2024-06-01 und muss am 2024-08-01 fertig sein.
Erstelle einen Projektplan mit: Design (2w), Entwicklung (4w), Testing (1w), Buffer
Mit Abhängigkeiten dass alles nacheinander läuft.
```

## Troubleshooting

### Tool wird nicht erkannt
**Problem:** Copilot zeigt das Tool nicht
- ✅ Stelle sicher, dass `npm run build` ausgeführt wurde
- ✅ Überprüfe den Pfad in `settings.json`
- ✅ Neustarte VS Code komplett
- ✅ Überprüfe, dass die `dist/index.js` existiert

### "Connection refused" Fehler
**Problem:** MCP Server kann sich nicht verbinden
- ✅ Überprüfe, dass Node.js installiert ist
- ✅ Teste manuell: `node dist/index.js` (sollte auf Eingabe warten)
- ✅ Überprüfe File-Pfade auf Leerzeichen (evtl. mit Quotes)

### Gantt-Diagramm wird nicht angezeigt
**Problem:** Response kommt, aber kein Diagramm im Chat
- ✅ Öffne Browser DevTools (F12) für weitere Fehler
- ✅ Probiere die Web-UI lokal: `npm run dev`
- ✅ Überprüfe, dass HTML gültig ist

## Debugging

### MCP Inspector für lokales Testing

Der MCP Inspector ist ein Dev-Tool zum Debuggen:

```bash
# 1. Terminal 1: MCP Server starten
cd C:\Users\<USERNAME>\Programmieren\MCP_Gantt
npm run mcp

# 2. Terminal 2: Inspector starten
npx @modelcontextprotocol/inspector node dist/index.js
```

Der Inspector öffnet sich dann im Browser auf http://localhost:3000 (oder ähnlich).

### Debug-Output

Für mehr Debugging-Informationen, editiere `src/index.ts` und füge hinzu:

```typescript
// Vor der Rückgabe
console.error('Tool input:', args);
console.error('Validation result:', validationResult);
console.error('Generated HTML length:', html.length);
```

Dann neu kompilieren:
```bash
npm run build
```

## Advanced Konfiguration

### Mit HTTP-Transport (optional)

Falls stdio Probleme bereitet, kann HTTP verwendet werden:

**settings.json:**
```json
{
  "mcp": {
    "servers": {
      "gantt": {
        "type": "http",
        "url": "http://localhost:3000/mcp"
      }
    }
  }
}
```

Dann müsste der Server so erweitert werden:
```typescript
// src/web/app.ts - MCP HTTP-Endpoint hinzufügen
app.post('/mcp', (req, res) => {
  // Handle MCP requests
});
```

### Environment-Variablen (optional)

Falls du Variablen übergeben möchtest:

**settings.json:**
```json
{
  "mcp": {
    "servers": {
      "gantt": {
        "type": "stdio",
        "command": "node",
        "args": ["..."],
        "env": {
          "LOG_LEVEL": "debug",
          "GANTT_VIEW_MODE": "Week"
        }
      }
    }
  }
}
```

## Häufige Fragen

### "Kann der Server auch in der Cloud deployed werden?"
Ja! Der Server kann als:
- Cloud Function (AWS Lambda, Azure Functions)
- Container (Docker)
- VM/Server deployed werden

Dann müsstest du den HTTP-Transport verwenden statt stdio.

### "Wie kann ich das Tool für andere verfügbar machen?"
1. Den Server als NPM-Package publishen
2. Dokumentation für andere bereitstellen
3. Sie installieren dann: `npm install -g @dein-username/mcp-gantt-server`

### "Kann man mehrere MCP Server gleichzeitig verwenden?"
Ja! In `settings.json` kannst du mehrere Server konfigurieren:

```json
{
  "mcp": {
    "servers": {
      "gantt": { ... },
      "github": { ... },
      "slack": { ... }
    }
  }
}
```

---

**Need help?** Überwache den MCP Inspector Output oder öffne ein Issue!
