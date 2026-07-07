# 09 – Benutzerdokumentation

**Service:** MCP Gantt Server · **Stand:** 2026-07-07

Für Endnutzer (z.B. in Copilot Studio) und Client-Administratoren.

---

## 1. Was macht der Service?

Du beschreibst deine Aufgaben (Name, Start- und Enddatum, optional Zuständige,
Abhängigkeiten), und der Service erzeugt daraus ein **Gantt-Diagramm als Bild**,
das der Assistent im Chat anzeigt.

## 2. Verbindung einrichten (Client-Admin)

### Microsoft Copilot Studio

1. Neuen (MCP-)Connector/Tool anlegen, Server-URL: `https://<host>/mcp`.
2. Authentifizierung: **API Key**
   - Parameter name: `x-api-key`
   - Location: **Header**
   - Wert: der bereitgestellte geheime Key
3. Verbindung speichern und testen (`tools/list` sollte `create_gantt_diagram` liefern).

### Generischer MCP-Client

```json
{
  "mcpServers": {
    "gantt": {
      "url": "https://<host>/mcp",
      "headers": { "x-api-key": "<dein-key>" }
    }
  }
}
```

Details siehe [../../API_KEY_AUTH.md](../../API_KEY_AUTH.md).

## 3. Eingabeformat (Beispiel)

```json
{
  "tasks": [
    { "id": "1", "name": "Konzept", "start": "2026-01-01", "end": "2026-01-10", "progress": 100 },
    { "id": "2", "name": "Umsetzung", "start": "2026-01-11", "end": "2026-02-01", "dependencies": "1" }
  ],
  "options": { "title": "Projektplan", "view_mode": "Week" }
}
```

**Pflichtfelder je Task:** `id`, `name`, `start`, `end` (Format `YYYY-MM-DD`).
Für einen Meilenstein: `start` = `end` und `milestone: true`.

## 4. Nutzungshinweise & Grenzen

- **Keine echten Klarnamen / personenbezogenen Daten** in `name`/`resource`
  eingeben, wenn nicht nötig — der Payload wird kurzzeitig serverseitig verarbeitet
  (siehe [03-datenschutzbewertung.md](03-datenschutzbewertung.md)). Keine besonderen
  Kategorien personenbezogener Daten (Gesundheit etc.) eingeben.
- Das Bild ist **kurzlebig**: Nach einiger Zeit oder einem Neustart ist die Bild-URL
  nicht mehr abrufbar. Bei Bedarf neu generieren.
- Beim ersten Aufruf nach Inaktivität kann es (Free-Hosting) ~50s dauern.

## 5. Häufige Fehler

| Symptom | Ursache | Lösung |
|---|---|---|
| `401 Unauthorized` | Key fehlt/falsch | Header `x-api-key` mit korrektem Wert setzen |
| Bild lädt nicht / 404 | Bild verdrängt/abgelaufen | Diagramm neu erzeugen |
| Bild-Link zeigt auf `localhost` | `SERVER_URL` serverseitig falsch | Betreiber informieren |
| `Validation failed` | z.B. `end` vor `start`, Zirkel-Dependency | Eingabe korrigieren (Fehlermeldung nennt Feld) |

## 6. Support

Bei Problemen: _[Support-Kanal aus 08-supportkonzept.md eintragen]_.
