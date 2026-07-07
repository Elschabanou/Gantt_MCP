import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * ========================
 * API-KEY-AUTHENTIFIZIERUNG
 * ========================
 *
 * Einfache Shared-Secret-Authentifizierung für den MCP-Endpunkt.
 * KEIN OAuth, KEIN Entra ID, KEINE Benutzeranmeldung — nur ein einzelner,
 * geheimer API-Key, der als Umgebungsvariable MCP_API_KEY hinterlegt wird.
 *
 * Der Client muss den Key in EINEM der folgenden Header mitschicken:
 *   - Authorization: Bearer <key>
 *   - x-api-key: <key>
 *
 * Bei fehlendem oder falschem Key antwortet der Server mit HTTP 401.
 */

/**
 * Extrahiert den vom Client gesendeten API-Key aus den Request-Headern.
 * Unterstützt sowohl `Authorization: Bearer <key>` als auch `x-api-key: <key>`.
 * Gibt `null` zurück, wenn kein Key gefunden wurde.
 */
function extractApiKey(req: Request): string | null {
  // x-api-key hat Vorrang, wenn gesetzt (typische Copilot-Studio-Konfiguration)
  const headerKey = req.header('x-api-key');
  if (headerKey && headerKey.length > 0) {
    return headerKey;
  }

  const authHeader = req.header('authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Constant-time-Vergleich zweier Strings.
 * Verhindert Timing-Angriffe, mit denen der korrekte Key zeichenweise
 * erraten werden könnte. `timingSafeEqual` wirft bei ungleicher Länge,
 * daher wird die Länge vorab abgefangen — ein Längen-Mismatch bedeutet
 * ohnehin, dass der Key falsch ist.
 */
function safeCompare(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Express-Middleware, die einen gültigen API-Key erzwingt.
 *
 * Der erwartete Key wird bei jedem Request aus `process.env.MCP_API_KEY`
 * gelesen (der Server bricht ohnehin beim Start ab, falls nicht gesetzt —
 * siehe Fail-Fast-Check in app.ts).
 *
 * Bewusst wird NICHT zwischen "Key fehlt" und "Key falsch" unterschieden:
 * beide Fälle liefern dieselbe generische 401-Antwort, um Enumeration zu
 * erschweren. Der gesendete/erwartete Key-Wert wird niemals geloggt.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const expectedKey = process.env.MCP_API_KEY;

  // Defense-in-depth: sollte durch den Fail-Fast-Check beim Start nie eintreten.
  if (!expectedKey) {
    console.error('[Auth] MCP_API_KEY ist nicht gesetzt — Request wird abgelehnt.');
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id ?? null,
      error: { code: -32603, message: 'Server misconfiguration' },
    });
    return;
  }

  const providedKey = extractApiKey(req);

  if (!providedKey || !safeCompare(providedKey, expectedKey)) {
    console.warn(`[Auth] Unauthorized request to ${req.path} from ${req.ip}`);
    res.status(401).json({
      jsonrpc: '2.0',
      id: req.body?.id ?? null,
      error: { code: -32001, message: 'Unauthorized: invalid or missing API key' },
    });
    return;
  }

  next();
}
