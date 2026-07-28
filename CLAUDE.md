# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # install dependencies
npm run build     # compile TypeScript (src/ -> dist/)
npm run dev       # tsx watch src/web/app.ts — hot-reloading dev server on :3000
npm start         # node dist/index.js — production server (requires build first)
npm run test:web  # build + run compiled web server (no automated test suite exists)
```

There is no lint script and no unit/integration test suite in this repo.

To exercise the server manually:

```bash
curl http://localhost:3000/health
curl -X POST http://localhost:3000/api/gantt -H "Content-Type: application/json" -d '{"tasks":[{"id":"1","name":"Task","start":"2024-01-01","end":"2024-01-15"}]}'
curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Architecture

This is a single-tool MCP (Model Context Protocol) server that turns a list of task objects into a Gantt chart PNG, exposed over HTTP for use by Copilot/Perplexity-style clients (not stdio).

### Entry point and the live MCP implementation

- `src/index.ts` just imports `src/web/app.ts` — there is no stdio transport wired up.
- **The live `/mcp` JSON-RPC endpoint is hand-rolled directly inside `src/web/app.ts`** (`app.post('/mcp', ...)`), including its own `initialize`, `tools/list`, and `tools/call` handling, its own copy of the tool's `inputSchema`, and its own request/response logging.
- `src/tools/schemas.ts` (Zod, `CreateGanttToolSchema`) is used for runtime validation of `tools/call` arguments, but the tool's advertised `inputSchema`/description in `tools/list` is a separate, hand-written literal in `app.ts` — the two can drift, so check both when changing a task/option field.

### Request flow for chart generation

1. Task/option JSON is validated against Zod schemas in `src/tools/schemas.ts` (`CreateGanttToolSchema`).
2. `GanttValidator` (`src/utils/task-validator.ts`) runs semantic checks: required fields, date format/logic (start ≤ end), progress range, duplicate IDs, and scheduling conflicts (past end-date with progress explicitly set below 100%). It delegates dependency validation to `DependencyChecker`.
3. `DependencyChecker` (`src/utils/dependency-checker.ts`) checks that all referenced dependency IDs exist and detects circular dependencies via DFS.
4. If valid, `GanttPNGGenerator` (`src/utils/png-generator.ts`) renders the chart: it builds an SVG string via `GanttSVGGenerator` (`src/utils/svg-generator.ts`, plain string templating — no chart library) and rasterizes it to PNG with `sharp`.
5. `GanttHTMLGenerator` (`src/utils/html-generator.ts`) still exists and is used only by `POST /api/gantt` (the local web-UI preview endpoint) — it is **not** part of the `/mcp` response path, which is PNG-only.

### Image delivery over MCP

Because MCP tool responses need a stable URL rather than an inline blob for some clients, generated PNGs are kept in an in-memory `Map` (`imageCache` in `app.ts`), keyed by `randomUUID()`, and served back at `GET /gantt-image/:id.png`. The `/mcp` tool response embeds a markdown image link built from `SERVER_URL` (env var, falls back to `http://localhost:${PORT}`) — **`SERVER_URL` must be set to the server's real public URL in any cloud deployment**, or generated image links will point at `localhost`. The cache has no persistence and is pruned periodically (oldest entries dropped once it exceeds 10 images); it is lost on restart.

### Stale/unused pieces worth knowing about

- `GanttHTMLGenerator` (`src/utils/html-generator.ts`) renders an HTML page that loads Frappe Gantt from a CDN — it's still live, but only for `POST /api/gantt` (the local web-UI preview endpoint); it is **not** part of the `/mcp` response path, which is PNG-only. `GanttOptions` fields like `view_mode`, `column_width`, `readonly*`, `popup_on`, `today_button`, `bar_corner_radius`, `arrow_curve`, and `date_format` only affect that Frappe Gantt preview — the actual PNG pipeline (`GanttSVGGenerator`) only reads `title` and `bar_height` from options.
- README.md and `COPILOT_INTEGRATION*.md` describe an earlier design (HTML-based Frappe Gantt output, stdio-first setup) that predates the PNG/public-image-endpoint approach — treat the actual `src/web/app.ts` code as the source of truth over these docs.

### Deployment

Render.com is the primary target (`render.yaml`, `DEPLOYMENT_RENDER.md`): `npm install && npm run build` then `npm start`. `Dockerfile` does a multi-stage build (compile in `builder`, copy `dist/` + `public/` into a slim runtime image) and exposes port 3000 with a `/health` healthcheck.
