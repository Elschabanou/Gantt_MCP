import 'dotenv/config'; // must be first: loads .env into process.env before anything reads it
import '../register-fonts.js'; // must be first: sets FONTCONFIG_FILE before sharp loads
import express, { Express, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { GanttValidator } from '../utils/task-validator.js';
import { GanttHTMLGenerator } from '../utils/html-generator.js';
import { GanttPNGGenerator } from '../utils/png-generator.js';
import { GanttPPTXGenerator } from '../utils/pptx-generator.js';
import { GanttTask, GanttOptions } from '../types.js';
import { CreateGanttToolSchema } from '../tools/schemas.js';
import { requireApiKey } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app: Express = express();
const PORT = process.env.PORT || 3000;
const MCP_PROTOCOL_VERSION = '2025-06-18';
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

// ========================
// FAIL-FAST: API-KEY MUSS GESETZT SEIN
// ========================
// Ohne MCP_API_KEY liefe der /mcp-Endpunkt ungeschützt. Wir brechen daher
// beim Start ab, statt versehentlich offen zu deployen (fail closed).
if (!process.env.MCP_API_KEY) {
  console.error(
    '❌ FATAL: Umgebungsvariable MCP_API_KEY ist nicht gesetzt.\n' +
      '   Der /mcp-Endpunkt darf nicht ohne API-Key laufen.\n' +
      '   Lege eine .env-Datei an (siehe .env.example) oder setze MCP_API_KEY im Environment.\n' +
      '   Key erzeugen z.B. mit: openssl rand -hex 32'
  );
  process.exit(1);
}

// ========================
// ASSET CACHE (In-Memory)
// ========================
// Store generated PNG/PPTX assets with unique IDs for public serving.
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
interface CachedAsset {
  buffer: Buffer;
  mimeType: string;
  timestamp: number;
  filename?: string;
}
const assetCache = new Map<string, CachedAsset>();

function cacheAsset(buffer: Buffer, mimeType: string, filename?: string): string {
  const id = randomUUID();
  assetCache.set(id, { buffer, mimeType, timestamp: Date.now(), filename });
  return id;
}

function pptxFileName(title?: string): string {
  const safe = (title?.trim() || 'gantt').replace(/[^\w\-. ]+/g, '_').slice(0, 60).trim();
  return `${safe || 'gantt'}.pptx`;
}

// Clean up old assets every 30 minutes once the cache exceeds 40 entries.
// Keeps the newest 20 rather than nuking everything above a threshold (the
// previous PNG-only version deleted `sorted.slice(0, 25)`, which for cache
// sizes 11-25 deleted *every* entry, including one handed to a client seconds
// earlier).
setInterval(() => {
  if (assetCache.size > 40) {
    const sorted = Array.from(assetCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = sorted.slice(0, Math.max(0, sorted.length - 20));
    toRemove.forEach(([key]) => assetCache.delete(key));
    console.log(`[Asset Cache] Cleaned up old assets. Cache size: ${assetCache.size}`);
  }
}, 30 * 60 * 1000);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

/**
 * ========================
 * GLOBAL REQUEST LOGGER
 * ========================
 * Log ALL requests to /mcp for debugging Perplexity integration
 */
app.use((req: Request, res: Response, next) => {
  if (req.path === '/mcp') {
    console.log('\n========== NEW REQUEST TO /mcp ==========');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Raw Body Type:', typeof req.body);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('=========================================\n');
  }
  next();
});

/**
 * ========================
 * MCP HTTP ENDPOINT
 * ========================
 * This is the main endpoint for Model Context Protocol requests
 * Copilot connects here to call the Gantt generation tool
 */

// Handle OPTIONS/HEAD requests (for Perplexity and other clients)
app.options('/mcp', (req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

app.head('/mcp', (req: Request, res: Response) => {
  res.sendStatus(200);
});

// GET /mcp - Streamable HTTP uses GET only for SSE streams.
// This server does not expose an SSE stream, so return 405.
app.get('/mcp', (req: Request, res: Response) => {
  console.log('[MCP] GET /mcp request (not supported)');
  res.setHeader('Allow', 'POST, OPTIONS');
  return res.sendStatus(405);
});

app.post('/mcp', requireApiKey, async (req: Request, res: Response) => {
  try {
    // Handle empty body
    if (!req.body || Object.keys(req.body).length === 0) {
      console.warn('[MCP] Empty or missing request body. Headers:', req.headers);
      return res.status(400).json({
        jsonrpc: '2.0',
        id: null,
        error: { 
          code: -32700, 
          message: 'Parse error: Empty body',
          details: 'Expected JSON-RPC 2.0 request with "method" field'
        },
      });
    }

    const { method, params, id } = req.body;

    if (!method) {
      console.warn('[MCP] Missing method in request. Body:', req.body);
      return res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: { 
          code: -32600, 
          message: 'Invalid Request: Missing method',
          received: Object.keys(req.body)
        },
      });
    }

    console.log(`[MCP] Method: ${method}, ID: ${id}`);

    let result: any;

    // Handle notifications (no id, no response expected)
    if (method.startsWith('notifications/')) {
      console.log(`[MCP] Notification received: ${method}`);
      // MCP Streamable HTTP notifications must return 202 Accepted with
      // no response body.
      return res.status(202).end();
    }

    // Handle initialize request (MCP Protocol Handshake)
    if (method === 'initialize') {
      console.log('[MCP] Initialize request - performing handshake');
      result = {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'mcp-gantt-server',
          version: '1.0.0',
        },
      };
    }
    // Handle tools/list request
    else if (method === 'tools/list') {
      result = {
        tools: [
          {
            name: 'create_gantt_diagram',
            description: `Creates a Gantt diagram from task definitions.
    
Input should be a JSON object with:
- tasks: Array of task objects with required fields (id, name, start, end). If your platform cannot construct a native array-of-objects parameter, pass this as a single JSON-encoded string of that same array instead (e.g. "[{\\"id\\":\\"1\\",\\"name\\":\\"...\\",\\"start\\":\\"2024-01-01\\",\\"end\\":\\"2024-01-15\\"}]").
- options: Optional Gantt display options (title, bar_height)

Each task must have:
- id: Unique identifier (string)
- name: Task name (string)
- start: Start date in YYYY-MM-DD format
- end: End date in YYYY-MM-DD format (for a milestone, use the same value as start)
- group: Project/swimlane label (optional). Tasks sharing a group share a color; use "Name / Subtitle" for a two-line label. Groups are colored pink, then teal, then green in order of appearance.
- milestone: true to render this item as a triangle marker (uses start as the date) instead of a bar (optional)
- dependencies: Comma-separated task IDs this task depends on (optional). Drawn as thin arrows from each predecessor to this task.
- priority: 'high', 'medium', or 'low' (optional)
- resource: Resource/person assignment (optional)
- risk: 'low', 'medium', or 'high' (optional). Marks the task as at risk: its bar gets a colored outline and it is listed in a "Risks" section below the chart. Use it to point out schedule risks such as tight deadlines, blocking dependencies or overloaded resources.
- risk_note: Short reason for the risk, shown next to the task in the risk section (optional, requires risk)

Options may include:
- title: Chart title shown at the top left (default: "Project Timeline")
- bar_height: Height of task bars in pixels (default: 22)

Validation includes:
✓ Circular dependency detection
✓ Date format and logic validation

Returns a static PNG image preview of the Gantt chart, plus a download link to an editable PowerPoint (.pptx) of the same chart: the chart background (grid, timeline, labels) is one image, and every task bar / milestone is a real, movable PowerPoint shape. Always mention the PowerPoint link to the user — dependency arrows and the timeline are part of the background image and won't move if a bar is dragged.`,
            inputSchema: {
              type: 'object',
              properties: {
                tasks: {
                  description:
                    'Array of task definitions. If your platform cannot fill a native array-of-objects parameter, provide a JSON-encoded string of the same array instead.',
                  oneOf: [
                    {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', description: 'Unique task identifier' },
                          name: { type: 'string', description: 'Task name' },
                          start: { type: 'string', description: 'Start date (YYYY-MM-DD format)' },
                          end: { type: 'string', description: 'End date (YYYY-MM-DD format)' },
                          progress: { type: 'number', description: 'Progress 0-100%', minimum: 0, maximum: 100 },
                          group: { type: 'string', description: 'Project/swimlane label; tasks sharing a group share a color. Use "Name / Subtitle" for a two-line label.' },
                          milestone: { type: 'boolean', description: 'Render as a triangle marker (uses start as the date) instead of a bar' },
                          dependencies: { type: 'string', description: 'Comma-separated dependent task IDs' },
                          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                          resource: { type: 'string', description: 'Resource or person assignment' },
                          risk: {
                            type: 'string',
                            enum: ['low', 'medium', 'high'],
                            description:
                              'Flag this task as at risk. Outlines the bar in the risk colour and lists the task in a "Risks" section below the chart. Only set it for tasks that really are at risk.',
                          },
                          risk_note: {
                            type: 'string',
                            description:
                              'Short reason for the risk (e.g. "Depends on external supplier"), shown next to the task in the risk section. Requires `risk`.',
                          },
                        },
                        required: ['id', 'name', 'start', 'end'],
                      },
                    },
                    {
                      type: 'string',
                      description:
                        'JSON-encoded string of the same task array — use this form if a native array-of-objects parameter cannot be constructed.',
                    },
                  ],
                },
                options: {
                  type: 'object',
                  properties: {
                    title: {
                      type: 'string',
                      description: 'Chart title shown at the top left (default: "Project Timeline")',
                    },
                    bar_height: {
                      type: 'number',
                      description: 'Height of task bars in pixels (default: 22)',
                    },
                  },
                  description: 'Optional Gantt display options',
                },
              },
              required: ['tasks'],
            },
          },
        ],
      };
    }
    // Handle tools/call request
    else if (method === 'tools/call') {
      const toolParams = params || {};
      const { name, arguments: args } = toolParams;

      if (name !== 'create_gantt_diagram') {
        return res.status(400).json({
          jsonrpc: '2.0',
          id,
          error: { code: -32600, message: `Unknown tool: ${name}` },
        });
      }

      try {
        // Validate input schema
        const validatedInput = CreateGanttToolSchema.parse(args);

        // Validate tasks
        const validator = new GanttValidator();
        const validationResult = validator.validate(validatedInput.tasks as GanttTask[]);

        if (!validationResult.valid) {
          const errorMessages = validationResult.errors
            .map((e: any) => `[${e.taskId}] ${e.field}: ${e.message}`)
            .join('\n');

          result = {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Validation failed:\n\n${errorMessages}`,
              },
            ],
          };
        } else {
          // Generate the PNG preview and the editable PowerPoint in parallel
          // (both are pure functions over the same tasks/options).
          const [pngBuffer, pptxBuffer] = await Promise.all([
            GanttPNGGenerator.generate(validatedInput.tasks as GanttTask[], validatedInput.options),
            GanttPPTXGenerator.generate(validatedInput.tasks as GanttTask[], validatedInput.options),
          ]);

          const imageId = cacheAsset(pngBuffer, 'image/png');
          const pptxId = cacheAsset(pptxBuffer, PPTX_MIME, pptxFileName(validatedInput.options?.title));
          const imageUrl = `${SERVER_URL}/gantt-image/${imageId}.png`;
          const pptxUrl = `${SERVER_URL}/gantt-pptx/${pptxId}.pptx`;

          // Build response text
          let responseText = `✅ Gantt diagram generated successfully!\n\n`;
          responseText += `📊 Tasks: ${validatedInput.tasks.length}\n`;

          if (validationResult.warnings.length > 0) {
            responseText += `\n⚠️  Warnings:\n`;
            validationResult.warnings.forEach((w: any) => {
              responseText += `  • ${w.message}\n`;
            });
          }

          responseText += `\n📈 Visual diagram:\n`;
          responseText += `![Gantt Diagram](${imageUrl})`;
          responseText += `\n\n📥 Editierbare PowerPoint (Balken sind echte Shapes):\n`;
          responseText += `[PowerPoint herunterladen](${pptxUrl})`;

          result = {
            isError: false,
            content: [
              {
                type: 'text',
                text: responseText,
              },
              // Trial: inline image content block, in addition to the URL above.
              // Some MCP clients (e.g. Claude Desktop) render this directly; others
              // (Perplexity, Copilot Studio) are expected to ignore it and fall back
              // to the markdown link in the text block.
              {
                type: 'image',
                data: pngBuffer.toString('base64'),
                mimeType: 'image/png',
              },
            ],
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';

        result = {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    } else {
      return res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    }

    // Send JSON-RPC response
    res.json({
      jsonrpc: '2.0',
      id,
      result: result,
    });
  } catch (error) {
    console.error('[MCP] Request error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    res.status(500).json({
      jsonrpc: '2.0',
      id: (req.body && req.body.id) !== undefined ? (req.body && req.body.id) : null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: process.env.NODE_ENV === 'development' ? message : undefined,
      },
    });
  }
});

// Health check endpoint (for monitoring)
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'MCP Gantt Server is running', timestamp: new Date().toISOString() });
});

/**
 * ========================
 * PUBLIC IMAGE ENDPOINT
 * ========================
 * Serve cached PNG images by ID
 * This allows Perplexity and other clients to fetch and display Gantt diagrams
 */
app.get('/gantt-image/:id.png', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const cached = assetCache.get(id);

  if (!cached || cached.mimeType !== 'image/png') {
    console.warn(`[Image] Not found: ${id}`);
    return res.status(404).json({ error: 'Image not found' });
  }

  console.log(`[Image] Serving: ${id}`);
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(cached.buffer);
});

/**
 * ========================
 * PUBLIC POWERPOINT ENDPOINT
 * ========================
 * Serve cached .pptx presentations by ID — the editable counterpart to the
 * PNG preview above, with the same "cache buffer, hand back a URL" pattern.
 */
app.get('/gantt-pptx/:id.pptx', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const cached = assetCache.get(id);

  if (!cached || cached.mimeType !== PPTX_MIME) {
    console.warn(`[PPTX] Not found: ${id}`);
    return res.status(404).json({ error: 'Presentation not found' });
  }

  console.log(`[PPTX] Serving: ${id} (${cached.buffer.length} bytes)`);
  res.setHeader('Content-Type', PPTX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${cached.filename ?? 'gantt.pptx'}"`);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(cached.buffer);
});

/**
 * API endpoint to create Gantt diagram
 */
app.post('/api/gantt', async (req: Request, res: Response) => {
  try {
    const { tasks, options } = req.body;

    // Basic validation
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({
        error: 'Tasks must be a non-empty array',
        example: {
          tasks: [
            {
              id: '1',
              name: 'Sample Task',
              start: '2024-01-01',
              end: '2024-01-15',
              progress: 50,
            },
          ],
        },
      });
    }

    // Validate with GanttValidator
    const validator = new GanttValidator();
    const validationResult = validator.validate(tasks as GanttTask[]);

    if (!validationResult.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      });
    }

    // Generate HTML preview plus the PNG and PPTX outputs in parallel
    const html = GanttHTMLGenerator.generate(tasks as GanttTask[], options as GanttOptions);
    const [pngBuffer, pptxBuffer] = await Promise.all([
      GanttPNGGenerator.generate(tasks as GanttTask[], options as GanttOptions),
      GanttPPTXGenerator.generate(tasks as GanttTask[], options as GanttOptions),
    ]);
    const pngBase64 = pngBuffer.toString('base64');

    // Store PNG/PPTX in cache and generate public URLs (for Perplexity and the local test UI)
    const imageId = cacheAsset(pngBuffer, 'image/png');
    const pptxId = cacheAsset(pptxBuffer, PPTX_MIME, pptxFileName((options as GanttOptions)?.title));
    const imageUrl = `${SERVER_URL}/gantt-image/${imageId}.png`;
    const pptxUrl = `${SERVER_URL}/gantt-pptx/${pptxId}.pptx`;

    // Return successful response with all formats
    res.json({
      success: true,
      taskCount: tasks.length,
      warnings: validationResult.warnings.length > 0 ? validationResult.warnings : null,
      html: html,
      png: pngBase64,  // For test UI (local preview)
      pngUrl: imageUrl,  // For Perplexity and other clients
      pptxUrl: pptxUrl,  // Editable PowerPoint download
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Failed to generate Gantt diagram',
      message: message,
    });
  }
});

/**
 * API endpoint to validate tasks
 */
app.post('/api/validate', (req: Request, res: Response) => {
  try {
    const { tasks } = req.body;

    if (!Array.isArray(tasks)) {
      return res.status(400).json({
        error: 'Tasks must be an array',
      });
    }

    const validator = new GanttValidator();
    const validationResult = validator.validate(tasks as GanttTask[]);

    res.json({
      valid: validationResult.valid,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Validation failed',
      message: message,
    });
  }
});

/**
 * API endpoint for sample data
 */
app.get('/api/examples', (req: Request, res: Response) => {
  res.json({
    simple: {
      tasks: [
        {
          id: '1',
          name: 'Project Setup',
          start: '2024-01-01',
          end: '2024-01-05',
          progress: 100,
          priority: 'high',
        },
        {
          id: '2',
          name: 'Design Phase',
          start: '2024-01-05',
          end: '2024-01-15',
          progress: 80,
          dependencies: '1',
          priority: 'high',
        },
        {
          id: '3',
          name: 'Development',
          start: '2024-01-15',
          end: '2024-02-01',
          progress: 30,
          dependencies: '2',
          priority: 'medium',
        },
        {
          id: '4',
          name: 'Testing',
          start: '2024-02-01',
          end: '2024-02-10',
          progress: 0,
          dependencies: '3',
          priority: 'medium',
        },
      ],
      options: {
        view_mode: 'Month',
        title: 'Simple Project Timeline',
      },
    },
    advanced: {
      tasks: [
        {
          id: 'planning',
          name: 'Project Planning',
          start: '2024-01-01',
          end: '2024-01-07',
          progress: 100,
          priority: 'high',
          resource: 'PM',
          group: 'Preparation',
        },
        {
          id: 'design',
          name: 'UI/UX Design',
          start: '2024-01-07',
          end: '2024-01-21',
          progress: 70,
          dependencies: 'planning',
          priority: 'high',
          resource: 'Designer',
          group: 'Design',
        },
        {
          id: 'backend',
          name: 'Backend Development',
          start: '2024-01-14',
          end: '2024-02-04',
          progress: 40,
          dependencies: 'planning',
          priority: 'high',
          resource: 'Backend Dev',
          group: 'Development',
        },
        {
          id: 'frontend',
          name: 'Frontend Development',
          start: '2024-01-21',
          end: '2024-02-04',
          progress: 20,
          dependencies: 'design,backend',
          priority: 'medium',
          resource: 'Frontend Dev',
          group: 'Development',
        },
        {
          id: 'integration',
          name: 'API Integration',
          start: '2024-02-04',
          end: '2024-02-11',
          progress: 0,
          dependencies: 'backend,frontend',
          priority: 'high',
          resource: 'Full Stack',
          group: 'Development',
        },
        {
          id: 'testing',
          name: 'QA Testing',
          start: '2024-02-11',
          end: '2024-02-18',
          progress: 0,
          dependencies: 'integration',
          priority: 'medium',
          resource: 'QA',
          group: 'Quality',
        },
        {
          id: 'deployment',
          name: 'Deployment',
          start: '2024-02-18',
          end: '2024-02-20',
          progress: 0,
          dependencies: 'testing',
          priority: 'high',
          resource: 'DevOps',
          group: 'Release',
          milestone: true,
        },
      ],
      options: {
        view_mode: 'Week',
        title: 'Advanced Project with Teams',
        today_button: true,
        popup_on: 'click',
      },
    },
    withDependencies: {
      tasks: [
        {
          id: '1',
          name: 'Foundation',
          start: '2024-01-01',
          end: '2024-01-10',
          progress: 100,
          milestone: false,
          group: 'Phase 1',
        },
        {
          id: '2',
          name: 'Layer A',
          start: '2024-01-10',
          end: '2024-01-20',
          progress: 80,
          dependencies: '1',
          priority: 'high',
          group: 'Phase 2',
        },
        {
          id: '3',
          name: 'Layer B',
          start: '2024-01-10',
          end: '2024-01-20',
          progress: 70,
          dependencies: '1',
          priority: 'high',
          group: 'Phase 2',
        },
        {
          id: '4',
          name: 'Assembly',
          start: '2024-01-20',
          end: '2024-01-30',
          progress: 0,
          dependencies: '2,3',
          priority: 'medium',
          group: 'Phase 3',
          milestone: true,
        },
      ],
      options: {
        view_mode: 'Month',
        title: 'Dependency Chain Project',
        view_mode_select: true,
      },
    },
    withMilestones: {
      tasks: [
        {
          id: 'kickoff',
          name: 'Project Kickoff',
          start: '2024-01-01',
          end: '2024-01-01',
          progress: 100,
          milestone: true,
          priority: 'high',
        },
        {
          id: 'requirements',
          name: 'Requirements Gathering',
          start: '2024-01-02',
          end: '2024-01-15',
          progress: 100,
          priority: 'high',
        },
        {
          id: 'milestone1',
          name: 'Requirements Complete',
          start: '2024-01-15',
          end: '2024-01-15',
          progress: 100,
          milestone: true,
          dependencies: 'requirements',
        },
        {
          id: 'design',
          name: 'Design Phase',
          start: '2024-01-16',
          end: '2024-02-01',
          progress: 50,
          dependencies: 'milestone1',
        },
        {
          id: 'milestone2',
          name: 'Design Review',
          start: '2024-02-01',
          end: '2024-02-01',
          progress: 0,
          milestone: true,
          dependencies: 'design',
        },
        {
          id: 'dev',
          name: 'Development',
          start: '2024-02-02',
          end: '2024-03-01',
          progress: 0,
          dependencies: 'milestone2',
        },
        {
          id: 'launch',
          name: 'Launch',
          start: '2024-03-01',
          end: '2024-03-01',
          progress: 0,
          milestone: true,
          dependencies: 'dev',
        },
      ],
      options: {
        view_mode: 'Month',
        title: 'Milestone-Based Project',
        today_button: true,
      },
    },
    withRisks: {
      tasks: [
        {
          id: 'concept',
          name: 'Concept & Scoping',
          start: '2026-08-03',
          end: '2026-08-21',
          progress: 100,
          resource: 'PM',
          group: 'Planning',
        },
        {
          id: 'supplier',
          name: 'Supplier Selection',
          start: '2026-08-24',
          end: '2026-09-18',
          progress: 40,
          dependencies: 'concept',
          resource: 'Procurement',
          group: 'Planning',
          risk: 'high',
          risk_note: 'External supplier not confirmed — blocks the whole build phase',
        },
        {
          id: 'prototype',
          name: 'Prototype Build',
          start: '2026-09-21',
          end: '2026-10-23',
          progress: 0,
          dependencies: 'supplier',
          resource: 'Engineering',
          group: 'Execution',
          risk: 'medium',
          risk_note: 'Depends on material delivery, only 1 week buffer',
        },
        {
          id: 'testing',
          name: 'Test & Validation',
          start: '2026-10-26',
          end: '2026-11-20',
          progress: 0,
          dependencies: 'prototype',
          resource: 'QA',
          group: 'Execution',
          risk: 'low',
          risk_note: 'Test rig shared with another project',
        },
        {
          id: 'launch',
          name: 'Trade Fair Launch',
          start: '2026-12-01',
          end: '2026-12-01',
          progress: 0,
          milestone: true,
          dependencies: 'testing',
          group: 'Release',
          risk: 'high',
          risk_note: 'Fixed external date, cannot be moved',
        },
      ],
      options: {
        view_mode: 'Month',
        title: 'Project with Risk Assessment',
      },
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MCP Gantt Web Server running at http://localhost:${PORT}`);
  console.log(`📊 Open http://localhost:${PORT} in your browser to test`);
  console.log(`🔌 HTTP Endpoints:`);
  console.log(`   POST /mcp - MCP JSON-RPC endpoint (for Copilot)`);
  console.log(`   POST /api/gantt - Generate Gantt diagram`);
  console.log(`   POST /api/validate - Validate tasks`);
  console.log(`   GET /api/examples - Get example data`);
  console.log(`   GET /gantt-image/:id.png - Serve cached chart PNGs`);
  console.log(`   GET /gantt-pptx/:id.pptx - Serve cached editable PowerPoint decks`);
  console.log(`   GET /health - Health check`);
});
