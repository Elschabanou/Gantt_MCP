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

### Entry point and the two MCP implementations

- `src/index.ts` just imports `src/web/app.ts` — there is no stdio transport wired up.
- **The live `/mcp` JSON-RPC endpoint is hand-rolled directly inside `src/web/app.ts`** (`app.post('/mcp', ...)`), including its own `initialize`, `tools/list`, and `tools/call` handling, its own copy of the tool's `inputSchema`, and its own request/response logging.
- `src/mcp-server.ts` (`createMCPServer`) is a second, SDK-based (`@modelcontextprotocol/sdk`) implementation of the same tool via `ListToolsRequestSchema`/`CallToolRequestSchema` handlers. It is imported into `app.ts` but **not actually used to serve requests** — the inline handlers in `app.ts` run first and never delegate to it.
- Net effect: **when changing the tool's schema, description, or behavior, `src/web/app.ts`'s inline `/mcp` handler is what's actually live in production.** `src/mcp-server.ts`, `src/tools/generate-gantt.ts`, and `src/tools/schemas.ts` (Zod) define the "canonical" version of the tool but can drift from what `app.ts` actually serves — check both when making changes, or you'll edit a copy nothing calls.

### Request flow for chart generation

1. Task/option JSON is validated against Zod schemas in `src/tools/schemas.ts` (`CreateGanttToolSchema`).
2. `GanttValidator` (`src/utils/task-validator.ts`) runs semantic checks: required fields, date format/logic (start ≤ end), progress range, duplicate IDs, resource capacity/overlap, and scheduling conflicts (past end-date with incomplete progress). It delegates dependency validation to `DependencyChecker`.
3. `DependencyChecker` (`src/utils/dependency-checker.ts`) checks that all referenced dependency IDs exist and detects circular dependencies via DFS; it also exposes a topological sort (Kahn's algorithm) for scheduling, though this isn't wired into the validator's errors/warnings.
4. If valid, `GanttPNGGenerator` (`src/utils/png-generator.ts`) renders the chart: it builds an SVG string via `GanttSVGGenerator` (`src/utils/svg-generator.ts`, plain string templating — no chart library) and rasterizes it to PNG with `sharp`.
5. `GanttHTMLGenerator` (`src/utils/html-generator.ts`) still exists and is used only by `POST /api/gantt` (the local web-UI preview endpoint) — it is **not** part of the `/mcp` response path, which is PNG-only.

### Image delivery over MCP

Because MCP tool responses need a stable URL rather than an inline blob for some clients, generated PNGs are kept in an in-memory `Map` (`imageCache` in `app.ts`), keyed by `randomUUID()`, and served back at `GET /gantt-image/:id.png`. The `/mcp` tool response embeds a markdown image link built from `SERVER_URL` (env var, falls back to `http://localhost:${PORT}`) — **`SERVER_URL` must be set to the server's real public URL in any cloud deployment**, or generated image links will point at `localhost`. The cache has no persistence and is pruned periodically (oldest entries dropped once it exceeds 10 images); it is lost on restart.

### Stale/unused pieces worth knowing about

- `puppeteer` and `frappe-gantt` are still listed in `package.json` but nothing in `src/` imports them anymore — chart rendering moved to the hand-built SVG→sharp pipeline. Don't assume README references to Frappe Gantt reflect current behavior.
- README.md and `COPILOT_INTEGRATION*.md` describe an earlier design (HTML-based Frappe Gantt output, stdio-first setup) that predates the PNG/public-image-endpoint approach — treat the actual `src/web/app.ts` code as the source of truth over these docs.

### Deployment

Render.com is the primary target (`render.yaml`, `DEPLOYMENT_RENDER.md`): `npm install && npm run build` then `npm start`. `Dockerfile` does a multi-stage build (compile in `builder`, copy `dist/` + `public/` into a slim runtime image) and exposes port 3000 with a `/health` healthcheck.
