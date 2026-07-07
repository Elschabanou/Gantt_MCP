# 02 – Sicherheitskonzept

**Service:** MCP Gantt Server · **Stand:** 2026-07-07 · **Status:** Prototyp

Legende Priorität: **MUSS** (Freigabe-Blocker) · **SOLLTE** (erwartet) · **OPTIONAL** (Reifegrad)

---

## 1. Authentifizierung

**Ist:** Shared-Secret-API-Key (`MCP_API_KEY`) über Header `x-api-key` oder
`Authorization: Bearer`. Vergleich constant-time (`crypto.timingSafeEqual`),
fail-closed beim Start, generische 401, kein Key-Logging.
Implementierung: `src/middleware/auth.ts`.

| Empfehlung | Warum | Aufwand | Nutzen f. Freigabe | Prio |
|---|---|---|---|---|
| **Entra ID / OAuth 2.0 statt Shared Key** | Enterprise-Reviews verlangen zentrale Identität, pro-Nutzer-Nachvollziehbarkeit, zentralen Entzug. Ein geteilter Key kennt keinen Nutzer und kann nicht selektiv widerrufen werden. | Hoch | Sehr hoch (oft Blocker) | **MUSS** (für echte Whitelist) |
| API-Key nur als PoC-Übergang | Für schnellen Test ausreichend, aber nicht für Produktivfreigabe | — erledigt | Mittel | erledigt |
| Key-Rotation dokumentieren & terminieren | Kompromittierung begrenzen | Niedrig | Mittel | SOLLTE |

## 2. Autorisierung

**Ist:** Binär — wer den Key hat, darf das einzige Tool aufrufen. Keine Rollen,
keine Scopes, keine Mandantentrennung.

| Empfehlung | Warum | Aufwand | Nutzen | Prio |
|---|---|---|---|---|
| Least-Privilege-Tool-Scope dokumentieren | Tool hat keinen Zugriff auf FS/Netz/DB — das ist ein Stärke-Argument, muss aber belegt sein | Niedrig | Hoch | **MUSS** |
| Pro-Nutzer-Autorisierung (mit OAuth) | Nachvollziehbarkeit, DSGVO-Betroffenenrechte | Hoch | Hoch | SOLLTE |

## 3. API-Schutz

**Ist:** Input-Validierung (Zod + `GanttValidator`), Empty-Body-Guard, JSON-RPC-Fehlercodes.
**Fehlt:** Rate-Limiting, Request-Size-Limit (`express.json()` ohne `limit`), Brute-Force-Schutz.

| Empfehlung | Warum | Aufwand | Nutzen | Prio |
|---|---|---|---|---|
| **Rate-Limiting vor `/mcp`** (`express-rate-limit`) | Missbrauch, DoS, Kostenkontrolle (Rendering ist CPU-intensiv via `sharp`) | Niedrig | Hoch | **MUSS** |
| **Body-Size-Limit** (`express.json({ limit: '256kb' })`) | Schutz vor Speicher-DoS durch riesige Task-Arrays | Sehr niedrig | Mittel | **MUSS** |
| Obergrenze Task-Anzahl / Bildgröße | Ressourcenschutz | Niedrig | Mittel | SOLLTE |
| `helmet` für Security-Header | Standard-Hardening | Sehr niedrig | Mittel | SOLLTE |

## 4. Secrets Management

**Ist:** Key aus `process.env.MCP_API_KEY`, nie im Code; `.env` in `.gitignore`,
`.env.example` mit leerem Platzhalter; auf Render als `sync: false`-Env-Var.

| Empfehlung | Warum | Aufwand | Nutzen | Prio |
|---|---|---|---|---|
| Managed Secret Store (Azure Key Vault) | Zentrale Rotation, Audit, kein Klartext im Hosting-Dashboard | Mittel | Hoch | SOLLTE |
| Pre-Commit-Secret-Scanning (gitleaks) | Verhindert versehentliches Committen (ist bereits einmal in `.env.example` passiert) | Niedrig | Hoch | **MUSS** |

## 5. Verschlüsselung

**Ist:** TLS in-transit (Render terminiert HTTPS). **At-rest:** keine persistente
Speicherung (nur RAM) → kein At-Rest-Bedarf, solange In-Memory-Design bleibt.

| Empfehlung | Warum | Aufwand | Nutzen | Prio |
|---|---|---|---|---|
| HTTPS erzwingen / HSTS | Key niemals über HTTP | Niedrig | Hoch | **MUSS** |
| Kein Downgrade auf persistente Speicher ohne At-Rest-Verschlüsselung | Falls Cache→DB migriert | — | Mittel | SOLLTE |

## 6. Key Management

Siehe Secrets. Zusätzlich: Rotationsintervall definieren (z.B. 90 Tage / bei
Personalwechsel / bei Verdacht), Verantwortlichen benennen, alten Key sofort entwerten.
**Prio: SOLLTE.**

## 7. Least Privilege

**Stärke:** Der Prozess braucht keine erhöhten Rechte, keinen DB-Zugriff, keinen
ausgehenden Netzzugriff. Container läuft (per Dockerfile) als schlankes Runtime-Image.

| Empfehlung | Warum | Aufwand | Nutzen | Prio |
|---|---|---|---|---|
| Container als non-root ausführen | Härtung, Standard-Review-Frage | Niedrig | Mittel | SOLLTE |
| Read-only Filesystem (außer temp) | Härtung | Niedrig | Mittel | OPTIONAL |

## 8. Logging

**Ist:** `console.log` (u.a. voller Request-Dump inkl. **aller Header** bei `/mcp` —
Achtung, kann Auth-Header enthalten!) → stdout → Render-Logs. Kein strukturiertes
Format, keine Korrelation, keine Aufbewahrungsrichtlinie.

| Empfehlung | Warum | Aufwand | Nutzen | Prio |
|---|---|---|---|---|
| **Auth-Header/Key aus Logs entfernen** | Der bestehende Header-Dump in `app.ts` (Zeile ~51) loggt `x-api-key`/`Authorization` im Klartext — Secret-Leak in Logs | Sehr niedrig | Hoch | **MUSS** |
| Strukturiertes Logging (JSON, pino) + Request-ID | Auditierbarkeit, Incident-Analyse | Niedrig | Hoch | SOLLTE |
| Log-Aufbewahrung & -Zugriff definieren | Compliance | Niedrig | Mittel | SOLLTE |

## 9. Monitoring

**Ist:** nur `GET /health` (statisch „ok"). Kein Metrics, kein Uptime-Monitor,
kein Fehler-Tracking.

| Empfehlung | Warum | Aufwand | Nutzen | Prio |
|---|---|---|---|---|
| Uptime-Monitor auf `/health` | Ausfallerkennung | Sehr niedrig | Hoch | **MUSS** |
| Error-Tracking (Sentry o.ä.) | Incident-Erkennung | Niedrig | Mittel | SOLLTE |
| Metrics (Requests, Latenz, Fehlerrate) | Kapazität, SLA-Nachweis | Mittel | Mittel | OPTIONAL |

## 10. Auditierbarkeit

**Ist:** faktisch keine — Logs sind flüchtig (Render free), nicht manipulationssicher,
enthalten keine stabile Nutzer-Identität (Shared Key).

| Empfehlung | Warum | Aufwand | Nutzen | Prio |
|---|---|---|---|---|
| Audit-Trail „wer hat wann welches Tool aufgerufen" | Nachvollziehbarkeit, DSGVO | Mittel | Hoch | SOLLTE (mit OAuth MUSS) |

## 11. Incident Response

**Ist:** kein Prozess. Siehe [08-supportkonzept.md](08-supportkonzept.md).

| Empfehlung | Warum | Aufwand | Nutzen | Prio |
|---|---|---|---|---|
| Minimaler IR-Plan (Rollen, Eskalation, Key-Notrotation, Kommunikationsweg) | Review-Standardanforderung | Niedrig | Hoch | **MUSS** |

---

## Zusammenfassung Sicherheitsreife

**Solide Basis für einen PoC** (fail-closed Auth, Input-Validierung, minimale
Angriffsfläche, keine persistente Datenhaltung). **Für Enterprise-Whitelist fehlen**
v.a.: föderierte Identität (Entra ID), Rate-Limiting/Size-Limits, Entfernen des
Secret-Leaks in Logs, Monitoring/Alerting und ein Incident-Prozess.
