# 04 – Betriebskonzept

**Service:** MCP Gantt Server · **Stand:** 2026-07-07 · **Status:** Prototyp

---

## 1. Rollen & Verantwortlichkeiten

| Rolle | Person | Verantwortung | Ist-Zustand |
|---|---|---|---|
| Service Owner | _[eintragen]_ | Fachverantwortung, Freigaben, Budget | ❌ nicht formalisiert |
| Technischer Betreiber | _[eintragen]_ | Deployment, Monitoring, Incidents | ⚠️ 1 Person (studentisch) |
| Vertretung | _[eintragen]_ | Backup bei Ausfall des Betreibers | ❌ keine |
| Security | _[eintragen]_ | Key-Rotation, Reviews | ❌ keine |

> **Muss-Gap:** Enterprise-Betrieb erfordert benannten Owner **und** Vertretung
> (keine Single-Person-Dependency). Aktuell nicht erfüllt.

## 2. Betreiber & Hosting

- **Plattform:** Render.com (PaaS), Plan **free**, Region Oregon (US).
- **Free-Plan-Einschränkungen:** kein SLA, Spin-down bei Inaktivität (Kaltstart-Latenz,
  ~50s), keine garantierte Verfügbarkeit, begrenzte Ressourcen. **Für Produktivbetrieb
  ungeeignet** → kostenpflichtiger Plan mit SLA erforderlich (**MUSS**).

## 3. Supportprozess

Siehe [08-supportkonzept.md](08-supportkonzept.md). Aktuell **kein** definierter
Kanal, keine Reaktionszeiten, kein Ticketing.

## 4. Incident Handling

Minimalprozess (zu etablieren):
1. **Erkennung:** Uptime-Monitor/Alert oder Nutzermeldung.
2. **Triage:** Betreiber prüft Render-Logs & `/health`.
3. **Eindämmung:** bei Kompromittierung → Key sofort rotieren (`MCP_API_KEY` neu setzen), ggf. Service pausieren.
4. **Behebung & Redeploy.**
5. **Post-Mortem** bei Sicherheits-/Datenschutzvorfällen; Meldepflichten (Art. 33 DSGVO, 72h) beachten.

**Prio: MUSS** (dokumentierter Minimalprozess).

## 5. Wartung & Patch-Management

**Ist:** keine automatisierten Dependency-Updates, kein Vulnerability-Scanning.

| Empfehlung | Aufwand | Nutzen | Prio |
|---|---|---|---|
| `npm audit` / Dependabot im CI | Niedrig | Hoch | **MUSS** |
| Regelmäßiges Basis-Image-Update (Docker) | Niedrig | Mittel | SOLLTE |
| Wartungsfenster/Update-Kadenz definieren | Niedrig | Mittel | SOLLTE |

## 6. Deployment- & Release-Prozess

**Ist:** `autoDeploy: true` → jeder Push auf `main` deployt automatisch. Kein
Staging, kein Freigabe-Gate, keine Tests im Pfad.

| Empfehlung | Warum | Aufwand | Nutzen | Prio |
|---|---|---|---|---|
| CI mit Build + Test-Gate vor Deploy | Fehler-/Regressionsschutz | Mittel | Hoch | **MUSS** |
| Staging-Umgebung | Änderungen testen vor Prod | Mittel | Mittel | SOLLTE |
| Versionierung/Changelog/Release-Tags | Nachvollziehbarkeit | Niedrig | Mittel | SOLLTE |
| Rollback-Verfahren dokumentieren (Render Rollback) | Wiederherstellung | Niedrig | Mittel | SOLLTE |

## 7. Backup & Recovery

**Ist:** Es gibt **keine persistenten Daten** → kein Datenbackup nötig (Design-Stärke).
Wiederherstellung des **Dienstes** erfolgt über Git (Infrastruktur als Code:
`render.yaml`, `Dockerfile`) + Redeploy.

| Empfehlung | Prio |
|---|---|
| Recovery-Runbook („Von Null zu lauffähig") dokumentieren | SOLLTE |
| Git-Repo-Backup / Zugriffssicherung | SOLLTE |

## 8. Kapazität & Kostenkontrolle

Rendering via `sharp` ist CPU-intensiv. Ohne Rate-Limiting kann Last/Kosten
unkontrolliert steigen (bei kostenpflichtigem Plan). → Rate-Limiting + Task-/Size-Limits
(siehe Sicherheitskonzept) sind auch **Kostenschutz**. **Prio: MUSS.**
