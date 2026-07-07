# 05 – Risikoanalyse

**Service:** MCP Gantt Server · **Stand:** 2026-07-07 · **Status:** Prototyp

Bewertung: Wahrscheinlichkeit (W) und Auswirkung (A) je **Niedrig / Mittel / Hoch**.
Risikostufe = W × A. Prio: **MUSS / SOLLTE / OPTIONAL**.

---

## R-01 … Sicherheit

| ID | Risiko | Beschreibung | W | A | Gegenmaßnahme | Prio |
|---|---|---|---|---|---|---|
| S-1 | **Secret-Leak über Logs** | `app.ts` dumpt bei `/mcp` alle Header inkl. `x-api-key`/`Authorization` nach stdout | Hoch | Hoch | Header-Redaction / Auth-Header aus Log entfernen | **MUSS** |
| S-2 | Shared-Key-Kompromittierung | Ein geleakter Key gibt vollen Zugriff, kein selektiver Entzug | Mittel | Hoch | OAuth/Entra ID, Key-Rotation, Vault | **MUSS** |
| S-3 | Kein Rate-Limiting → Brute-Force/DoS | Endloses Key-Raten oder Last-DoS möglich | Mittel | Mittel | `express-rate-limit`, Body-Size-Limit | **MUSS** |
| S-4 | Fehlende Security-Header | Kein `helmet` | Niedrig | Niedrig | `helmet` | SOLLTE |
| S-5 | Öffentlicher Bild-Endpoint | `/gantt-image/:id.png` ohne Auth | Niedrig | Niedrig | UUID nicht erratbar; ggf. signierte/ablaufende URLs | OPTIONAL |

## R-02 … Datenschutz

| ID | Risiko | W | A | Gegenmaßnahme | Prio |
|---|---|---|---|---|---|
| D-1 | US-Hosting ohne AVV/Transfergrundlage | Hoch | Hoch | EU-Region + AVV | **MUSS** |
| D-2 | Personenbezug in Payload unkontrolliert | Mittel | Mittel | Nutzerhinweis, Datenminimierung | SOLLTE |
| D-3 | IP-/Header-Logging | Mittel | Mittel | Redaction, Aufbewahrungsfrist | **MUSS** |
| D-4 | Kein Verarbeitungsverzeichnis | Hoch | Mittel | VVT-Eintrag | SOLLTE |

## R-03 … Verfügbarkeit

| ID | Risiko | W | A | Gegenmaßnahme | Prio |
|---|---|---|---|---|---|
| V-1 | Free-Plan ohne SLA, Spin-down/Kaltstart | Hoch | Mittel | Bezahlplan mit SLA | **MUSS** |
| V-2 | Single-Instance, kein Failover | Mittel | Mittel | Mehrere Instanzen / Health-basiertes Restart | SOLLTE |
| V-3 | Kein Monitoring/Alerting | Hoch | Mittel | Uptime-Monitor + Alerts | **MUSS** |
| V-4 | Cache-Verlust bei Neustart | Hoch | Niedrig | Bewusst akzeptiert (kurzlebige Bilder) | OPTIONAL |

## R-04 … Kosten

| ID | Risiko | W | A | Gegenmaßnahme | Prio |
|---|---|---|---|---|---|
| K-1 | Unbegrenztes Rendering → CPU-/Kostenexplosion | Mittel | Mittel | Rate-Limiting, Task-/Size-Limits | **MUSS** |
| K-2 | Kein Kosten-Alerting | Mittel | Niedrig | Budget-Alerts im Hosting | SOLLTE |

## R-05 … Governance

| ID | Risiko | W | A | Gegenmaßnahme | Prio |
|---|---|---|---|---|---|
| G-1 | Kein benannter Owner/Vertretung | Hoch | Hoch | Rollen formalisieren | **MUSS** |
| G-2 | Auto-Deploy ohne Freigabe-Gate/Tests | Hoch | Mittel | CI-Gate, Staging | **MUSS** |
| G-3 | Keine Dokumentation des Lifecycles/Offboardings | Mittel | Mittel | Governance-Doc (dieses Set) | SOLLTE |

## R-06 … Missbrauch (inkl. MCP-spezifisch)

| ID | Risiko | W | A | Gegenmaßnahme | Prio |
|---|---|---|---|---|---|
| M-1 | Prompt-Injection über Tool-Output | Niedrig | Niedrig | Output ist statischer Text+Bild-URL, keine Ausführung; Markdown-URL aus vertrauenswürdiger `SERVER_URL` | SOLLTE |
| M-2 | Datenexfiltration über Tool | Niedrig | Niedrig | Tool hat **keinen** ausgehenden Netz-/FS-Zugriff → nichts zu exfiltrieren | OPTIONAL |
| M-3 | SSRF / Server-seitiger Fetch | Sehr niedrig | Mittel | Kein serverseitiger Fetch von Nutzer-URLs vorhanden | OPTIONAL |
| M-4 | Ressourcen-Missbrauch (riesige Diagramme) | Mittel | Mittel | Task-/Size-Limits, Rate-Limit | **MUSS** |

## R-07 … Fehlkonfiguration

| ID | Risiko | W | A | Gegenmaßnahme | Prio |
|---|---|---|---|---|---|
| F-1 | `MCP_API_KEY` in Cloud nicht gesetzt | Mittel | Mittel | **fail-closed** bereits implementiert (Start bricht ab) ✔ | erledigt |
| F-2 | `SERVER_URL` falsch → Bild-Links auf localhost | Mittel | Mittel | In Doku hervorgehoben; ggf. Startup-Warnung | SOLLTE |
| F-3 | Secret versehentlich committet | Mittel | Hoch | gitleaks Pre-Commit; `.env.example` bereinigt ✔ | **MUSS** |

---

## Top-Risiken (Handlungsempfehlung)

1. **S-1** Secret-Leak in Logs — sofort beheben (kleiner Aufwand, hoher Nutzen).
2. **D-1 / V-1** US-Free-Hosting — EU-Bezahlplan + AVV.
3. **S-2** Auth auf Entra ID/OAuth heben (größter Whitelist-Hebel).
4. **G-1 / G-2** Owner + Release-Gate formalisieren.
5. **S-3/K-1/M-4** Rate-Limiting & Size-Limits (deckt Security, Kosten, Missbrauch ab).
