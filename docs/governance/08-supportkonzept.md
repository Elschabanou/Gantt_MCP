# 08 – Supportkonzept

**Service:** MCP Gantt Server · **Stand:** 2026-07-07 · **Status:** Prototyp

> Aktuell existiert **kein** formaler Support. Dieses Dokument definiert den
> Soll-Prozess für eine spätere Freigabe. Felder mit _[…]_ sind auszufüllen.

---

## 1. Support-Kanäle

| Kanal | Adresse | Zweck |
|---|---|---|
| Primär (Ticket/E-Mail) | _[eintragen]_ | Störungen, Anfragen |
| Eskalation | _[eintragen]_ | kritische Incidents |
| Security-Meldung | _[eintragen]_ | Sicherheits-/Datenschutzvorfälle |

## 2. Service-Zeiten & Reaktionszeiten (Vorschlag)

| Priorität | Definition | Reaktionszeit | Servicezeit |
|---|---|---|---|
| P1 – Kritisch | Dienst nicht erreichbar / Security-Vorfall | _[z.B. 4h]_ | _[z.B. 9–17 Uhr werktags]_ |
| P2 – Hoch | Kernfunktion gestört | _[1 AT]_ | werktags |
| P3 – Normal | Einzelfehler, Rückfragen | _[3 AT]_ | werktags |

> Realistisch für ein Ein-Personen-Projekt: **Best-Effort ohne garantierte Zeiten**,
> bis Owner/Vertretung und ggf. Bezahlplan mit SLA etabliert sind.

## 3. Rollen im Support

| Rolle | Person | Aufgabe |
|---|---|---|
| 1st-Level | _[eintragen]_ | Annahme, Triage, `/health`/Logs prüfen |
| 2nd-Level | _[eintragen]_ | Code/Deploy-Analyse, Fix |
| Vertretung | _[eintragen]_ | Abwesenheitsvertretung |

## 4. Incident-Handling (Kurz)

1. Meldung/Alert → Ticket.
2. Triage & Priorisierung (P1–P3).
3. Eindämmung (bei Security: **Key-Notrotation**, ggf. Dienst pausieren).
4. Behebung & Redeploy (Render Rollback als Option).
5. Nutzer-Rückmeldung, ggf. Post-Mortem + Meldepflichten (DSGVO Art. 33, 72h).

## 5. Bekannte Einschränkungen (für Support-FAQ)

- **Kaltstart** auf Free-Plan: erster Request nach Inaktivität dauert ~50s.
- **Bild-Links kurzlebig**: PNGs verschwinden nach Cache-Verdrängung/Neustart.
- **Falsche `SERVER_URL`** → Bild-Links zeigen auf `localhost` (Konfigurationsfehler).
- **401 bei fehlendem/falschem Key** — Key im Client-Header prüfen.

## 6. Wartungsfenster

_[Kadenz/Uhrzeit definieren]_ — für Dependency-Updates und Basis-Image-Patches.
Ankündigung an Nutzer über _[Kanal]_.
