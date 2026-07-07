import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

/**
 * Makes the bundled Porsche Next TT brand font available to the PNG renderer.
 *
 * The SVG is rasterized to PNG by sharp (libvips + librsvg + Pango). On Linux —
 * the deploy target — Pango resolves fonts through fontconfig, which only sees
 * fonts in its configured directories (a bare `font-family` name or a base64
 * `@font-face` in the SVG is NOT enough; librsvg ignores `@font-face`). So at
 * startup we generate a fontconfig config that adds our `assets/fonts` folder
 * and point fontconfig at it via the FONTCONFIG_FILE env var.
 *
 * On macOS Pango uses CoreText instead of fontconfig, so this is effectively a
 * no-op there (local dev relies on the system-installed font) — but it is also
 * harmless.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PORSCHE_FONT_FAMILY = 'Porsche Next TT';
export const PORSCHE_FONT_STACK = `'${PORSCHE_FONT_FAMILY}', 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif`;

const PROBE_FILE = 'PorscheNextTT-Regular.ttf';

// The compiled module lives in dist/utils; the fonts live in assets/fonts at
// the project root. Try a few locations so it works from source, dist, Docker
// and Render alike.
const CANDIDATE_DIRS = [
  path.join(__dirname, '../../assets/fonts'),
  path.join(__dirname, '../assets/fonts'),
  path.join(process.cwd(), 'assets/fonts'),
];

let registered = false;

/**
 * Registers the bundled Porsche Next TT font with fontconfig. Idempotent, and
 * must run before the first sharp text render (fontconfig reads FONTCONFIG_FILE
 * on first initialization). Failures are non-fatal: text falls back to the
 * sans-serif in the font stack.
 */
export function registerPorscheFonts(): void {
  if (registered) return;
  registered = true;

  const fontDir = CANDIDATE_DIRS.find((dir) => existsSync(path.join(dir, PROBE_FILE)));
  if (!fontDir) {
    console.warn(
      '[fonts] Porsche Next TT not found in assets/fonts; PNG text will use a fallback font.'
    );
    return;
  }

  try {
    const cacheDir = path.join(os.tmpdir(), 'gantt-fontconfig-cache');
    mkdirSync(cacheDir, { recursive: true });

    const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${escapeXml(fontDir)}</dir>
  <dir>/usr/share/fonts</dir>
  <dir>/usr/local/share/fonts</dir>
  <dir prefix="xdg">fonts</dir>
  <dir>~/.fonts</dir>
  <cachedir>${escapeXml(cacheDir)}</cachedir>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
</fontconfig>
`;

    const confPath = path.join(os.tmpdir(), 'gantt-fonts.conf');
    writeFileSync(confPath, conf, 'utf8');
    process.env.FONTCONFIG_FILE = confPath;

    console.log(`[fonts] Registered Porsche Next TT for fontconfig (dir: ${fontDir}).`);
  } catch (error) {
    console.warn('[fonts] Failed to register Porsche Next TT for fontconfig:', error);
  }
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
