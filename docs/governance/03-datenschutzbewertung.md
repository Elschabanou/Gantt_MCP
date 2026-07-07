# 03 – Datenschutzbewertung (DSGVO)

**Service:** MCP Gantt Server · **Stand:** 2026-07-07 · **Status:** Prototyp
**Verantwortlicher i.S.d. Art. 4 DSGVO:** _[Organisation/Person eintragen]_
**Datenschutzbeauftragter:** _[eintragen]_

> Dies ist eine **Vorbewertung** zur Vorbereitung einer ggf. erforderlichen
> Datenschutz-Folgenabschätzung (DSFA/DPIA), keine abgeschlossene DSFA.

---

## 1. Verarbeitete Daten

| Datenfeld | Quelle | Personenbezug | Zweck |
|---|---|---|---|
| `task.name` | Client-Eingabe | möglich (z.B. „Gespräch mit Herrn X") | Diagrammbeschriftung |
| `task.start` / `task.end` | Client-Eingabe | nein | Zeitachse |
| `task.resource` | Client-Eingabe | **ja** (Ressourcen-/Personennamen, z.B. „Max Mustermann", „PM") | Zuordnung im Diagramm |
| `task.group` | Client-Eingabe | ggf. (Team-/Abteilungsnamen) | Gruppierung |
| Request-Header (Logs) | Transport | ggf. (IP-Adresse in `req.ip`, Client-Metadaten) | Debugging/Logging |
| Generiertes PNG | abgeleitet | enthält obige Inhalte visuell | Auslieferung an Client |

## 2. Datenklassifizierung

- **Vertraulichkeit:** abhängig vom Inhalt des Payloads — potenziell **intern/vertraulich**
  (Projektpläne können Geschäftsgeheimnisse und Personennamen enthalten).
- **Personenbezogene Daten:** möglich über `resource`, `name`, `group` sowie IP in Logs.
- **Besondere Kategorien (Art. 9):** nicht vorgesehen; hängt aber allein von der
  Nutzereingabe ab → in der Benutzerdokumentation ausschließen/untersagen.

## 3. Datenminimierung (Stärke)

- **Keine persistente Speicherung.** PNGs liegen nur im RAM (`imageCache`), TTL
  faktisch bis Cache-Überlauf (> 10 Einträge) bzw. Prozess-Neustart, spätestens
  ~30 Min Pruning-Intervall. Kein Payload-Persistieren, keine DB, keine Analytics.
- Kein Tracking, keine Weitergabe an Dritte durch die App selbst.

Das In-Memory-Design ist datenschutzfreundlich („privacy by design", Art. 25) —
sollte **dokumentiert und beibehalten** werden.

## 4. Speicherorte & Drittlandtransfer ⚠️

**Kritisch:** Hosting auf **Render.com, Region Oregon (US)**.
- Verarbeitung personenbezogener Daten in einem **Drittland (USA)**.
- Erfordert Transfergrundlage (Data Privacy Framework / Standardvertragsklauseln)
  und einen **Auftragsverarbeitungsvertrag (AVV / DPA)** mit Render.
- Ebenso: die Bild-URLs werden an den MCP-Client (Copilot Studio/Microsoft)
  übermittelt und dort ggf. verarbeitet → Microsoft als weiterer Empfänger.

| Empfehlung | Prio |
|---|---|
| **Hosting in EU-Region** verlagern (Render EU / Azure EU) | **MUSS** |
| **AVV mit Hosting-Provider** abschließen | **MUSS** |
| Transfermechanismus dokumentieren, falls US bleibt | MUSS (falls US) |
| Microsoft-/Copilot-Datenfluss in Verarbeitungsverzeichnis aufnehmen | SOLLTE |

## 5. Datenlöschung & Aufbewahrung

- **Payload/PNG:** automatische Verdrängung aus RAM (s.o.), kein manueller
  Löschprozess nötig, keine Backups des Payloads.
- **Logs:** aktuell Render-Standard (flüchtig). Aufbewahrungsfrist **undokumentiert**
  → definieren (z.B. 7–30 Tage), IP-Logging minimieren/anonymisieren.

| Empfehlung | Prio |
|---|---|
| Log-Aufbewahrungsfrist definieren & IP-Anonymisierung | SOLLTE |
| **Auth-/Header-Dump aus Logs entfernen** (enthält Key + ggf. IP) | **MUSS** (auch Security) |

## 6. Betroffenenrechte

Aufgrund fehlender Persistenz und fehlender Nutzeridentität sind Auskunft/Löschung
technisch kaum adressierbar — aber durch die kurze Lebensdauer der Daten auch
geringes Risiko. Mit OAuth/Nutzeridentität würde Nachvollziehbarkeit möglich.

## 7. DSGVO-Risiken (Kurz)

| Risiko | Wahrscheinlichkeit | Auswirkung | Gegenmaßnahme |
|---|---|---|---|
| US-Datenverarbeitung ohne AVV/Transfergrundlage | Hoch (Ist-Zustand) | Hoch | EU-Region + AVV |
| Personenbezug in `resource`/`name` unkontrolliert | Mittel | Mittel | Nutzerhinweis, Datenminimierung, keine Klarnamen empfehlen |
| Secret/IP-Leak über Logs | Mittel | Mittel–Hoch | Log-Redaction |
| Kein Verarbeitungsverzeichnis-Eintrag | Hoch | Mittel | VVT-Eintrag erstellen |

## 8. Fazit

Durch das In-Memory-/No-Persistence-Design ist das inhärente Datenschutzrisiko
**niedriger als bei typischen Web-Services**. Die **Hauptlücken** sind
**US-Hosting ohne AVV/Transfergrundlage** und der **Header-/Secret-Dump in Logs**.
Beide sind vor einer Enterprise-Freigabe zu schließen; eine formale DSFA-Prüfung
durch den DSB wird empfohlen.
