# Render Deployment Guide

Dieses Dokument beschreibt wie der MCP Gantt Server auf [Render.com](https://render.com) deployed wird.

## 🚀 Schnellstart (5 Minuten)

### 1. Render Account erstellen
- Besuche https://render.com
- Registriere dich mit GitHub/GitLab Account
- Authorisiere Render auf GitHub

### 2. Repository zu GitHub pushen
```bash
git add .
git commit -m "Add MCP Gantt Server"
git push origin main
```

### 3. Render Web Service erstellen

**Option A: Über Render Dashboard**
1. Gehe zu https://dashboard.render.com
2. Klick "New +" → "Web Service"
3. Wähle dein GitHub Repository
4. Konfiguriere:
   - **Name**: `mcp-gantt` (oder beliebig)
   - **Region**: `Oregon` (kostenlos) oder deine Nähe
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free` (ausreichend für Testing)

5. Klick "Create Web Service"

**Option B: Über Infrastructure as Code (render.yaml)**

Erstelle `render.yaml` im Root:

```yaml
services:
  - type: web
    name: mcp-gantt
    runtime: node
    plan: free
    branch: main
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

Dann:
```bash
git add render.yaml
git commit -m "Add render deployment config"
git push origin main
```

### 4. Deployment starten

Nach dem Push startet Render automatisch den Deploy (ca. 2-3 Minuten).

Du siehst den Deploy-Status im Render Dashboard:
- 🟡 **Building** - Abhängigkeiten installieren, TypeScript kompilieren
- 🟡 **Deploying** - Server starten
- 🟢 **Live** - Fertig! URL wird angezeigt

## ✅ Nach dem Deploy

### Health Check
```bash
curl https://your-service.onrender.com/health
# {"status":"ok","message":"MCP Gantt Server is running",...}
```

### MCP Test
```bash
curl -X POST https://your-service.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Web UI öffnen
Besuche: https://your-service.onrender.com

## 🔧 Konfiguration

### Umgebungsvariablen
Im Render Dashboard unter Service Settings → Environment:

```
NODE_ENV=production
PORT=3000
```

### Custom Domain (optional)
1. Im Dashboard: Service → Settings → Custom Domain
2. Gib deine Domain ein (z.B. `gantt.yoursite.com`)
3. Folge DNS-Setup Anleitung

## 🚨 Troubleshooting

### Deploy fehlgeschlagen?

**Build Error: "npm run build failed"**
```
→ Check TypeScript errors: npm run build lokal
→ Verfiy dist/ folder not in .gitignore
```

**Deploy Error: "Cannot find module"**
```
→ npm install lokal ausführen
→ Commit package-lock.json zu GitHub
```

**Service startet nicht (503 error)**
```
→ Check: npm start lädt http://localhost:3000?
→ Logs anschauen: Render Dashboard → Logs
→ Restart: Dashboard → Service → Restart
```

### Logs anschauen

Im Render Dashboard:
1. Wähle dein Service
2. Klick auf "Logs" Tab
3. Scrolle nach unten für aktuelle Logs

Oder via CLI:
```bash
npm install -g @render/render-cli
render logs --service-id=<your-service-id>
```

## 📊 Monitoring

### Render-Metriken
Dashboard zeigt automatisch:
- CPU Auslastung
- Memory Nutzung
- Request Count
- Response Times

### Custom Alerts (Pro Plan)
```
Settings → Alerts
→ Email bei Service Crashes/Errors
```

## 💰 Kosten

**Free Plan:**
- ✅ Kostenlos
- ✅ 0.5 GB RAM
- ✅ Shared CPU
- ⚠️ Schläft nach 15 Min Inaktivität (Cold Start ~30s)
- ✅ HTTPS inklusive

**Paid Plans:**
- **Starter**: $7/Monat
  - 1 GB RAM
  - Dedicated CPU
  - Kein Schlaf
  - DDoS Protection

## 🔄 Auto-Deploy

Render deployt automatisch nach `git push`:

```bash
# Der Deploy triggert automatisch!
git commit -m "Fix bug"
git push origin main
# → Render startet Build & Deploy in ~2 Min
```

Um Auto-Deploy zu deaktivieren:
1. Dashboard → Service → Settings
2. Auto-Deploy → Toggle aus

## 🆙 Updates deployieren

```bash
# Code ändern
nano src/web/app.ts

# Testen lokal
npm run dev

# Zu GitHub pushen
git add .
git commit -m "Update feature"
git push origin main

# Render deployt automatisch!
# Check Status: Render Dashboard
```

## 🔐 Sicherheit

### HTTPS
✅ Automatisch aktiviert (Render-Domain: *.onrender.com)

### Authentifizierung (optional)
Falls Sie den MCP Endpoint schützen möchten:

```typescript
// src/web/app.ts
import basicAuth from 'express-basic-auth';

const password = process.env.MCP_PASSWORD || 'insecure';

app.post('/mcp', basicAuth({
  users: { 'admin': password },
  challenge: true
}), (req, res) => {
  // Handle MCP request
});
```

Render Environment Variable setzen:
```
MCP_PASSWORD=your-secure-password
```

### DDoS Protection
Included on Starter+ Plans

## 📚 Weitere Ressourcen

- [Render Docs](https://render.com/docs)
- [Node.js on Render](https://render.com/docs/deploy-node-express)
- [Troubleshooting Guide](https://render.com/docs/troubleshooting)

## 🆘 Support

- **Render Support**: https://render.com/support
- **This Project**: Check GitHub Issues
