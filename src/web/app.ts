import express, { Express, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GanttValidator } from '../utils/task-validator.js';
import { GanttHTMLGenerator } from '../utils/html-generator.js';
import { GanttTask, GanttOptions } from '../types.js';
import { CreateGanttToolSchema } from '../tools/schemas.js';
import { createMCPServer } from '../mcp-server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app: Express = express();
const PORT = process.env.PORT || 3000;

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

// GET /mcp - Return tools/list for initial discovery
app.get('/mcp', (req: Request, res: Response) => {
  console.log('[MCP] GET /mcp request (discovery)');
  res.json({
    jsonrpc: '2.0',
    id: null,
    result: {
      tools: [
        {
          name: 'create_gantt_diagram',
          description: 'Creates a Gantt diagram from task definitions.',
        },
      ],
    },
  });
});

app.post('/mcp', async (req: Request, res: Response) => {
  try {
    // Log incoming request for debugging
    console.log('[MCP] POST /mcp request received');
    console.log('[MCP] Headers:', {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      'content-length': req.headers['content-length'],
    });
    console.log('[MCP] Body keys:', Object.keys(req.body || {}).join(', '));
    console.log('[MCP] Full body:', JSON.stringify(req.body, null, 2));

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

    const { method, params, id, jsonrpc } = req.body;

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
      // Some clients (eg. Perplexity) perform strict JSON-RPC validation
      // on HTTP responses. Returning a bare `{}` causes validation errors
      // (missing required JSON-RPC fields). Return a minimal valid
      // JSON-RPC response object to satisfy validators.
      // Some validators require `id` to be a string or integer.
      // Use `0` to represent a generic acknowledgement that will
      // satisfy strict JSON-RPC validators (Pydantic expects int/str).
      return res.status(200).json({
        jsonrpc: '2.0',
        id: 0,
        result: {},
      });
    }

    // Handle initialize request (MCP Protocol Handshake)
    if (method === 'initialize') {
      console.log('[MCP] Initialize request - performing handshake');
      result = {
        protocolVersion: '2024-11-05',
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
- tasks: Array of task objects with required fields (id, name, start, end)
- options: Optional Gantt display options (view_mode, bar_height, etc.)

Each task must have:
- id: Unique identifier (string)
- name: Task name (string)
- start: Start date in YYYY-MM-DD format
- end: End date in YYYY-MM-DD format
- progress: Progress percentage 0-100 (optional)
- dependencies: Comma-separated task IDs this task depends on (optional)
- priority: 'high', 'medium', or 'low' (optional)
- custom_class: CSS class name (optional)
- resource: Resource/person assignment (optional)

Validation includes:
✓ Circular dependency detection
✓ Date format and logic validation
✓ Progress range validation (0-100)
✓ Resource capacity checks

Returns HTML containing an interactive Gantt chart ready to display.`,
            inputSchema: {
              type: 'object',
              properties: {
                tasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', description: 'Unique task identifier' },
                      name: { type: 'string', description: 'Task name' },
                      start: { type: 'string', description: 'Start date (YYYY-MM-DD format)' },
                      end: { type: 'string', description: 'End date (YYYY-MM-DD format)' },
                      progress: { type: 'number', description: 'Progress 0-100%', minimum: 0, maximum: 100 },
                      dependencies: { type: 'string', description: 'Comma-separated dependent task IDs' },
                      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                      custom_class: { type: 'string', description: 'CSS class for styling' },
                      resource: { type: 'string', description: 'Resource or person assignment' },
                    },
                    required: ['id', 'name', 'start', 'end'],
                  },
                  description: 'Array of task definitions',
                },
                options: {
                  type: 'object',
                  properties: {
                    view_mode: {
                      type: 'string',
                      enum: ['Day', 'Week', 'Month', 'Year'],
                      description: 'Timeline view mode (default: Month)',
                    },
                    bar_height: {
                      type: 'number',
                      description: 'Height of task bars in pixels (default: 30)',
                    },
                    column_width: {
                      type: 'number',
                      description: 'Width of timeline columns (default: 45)',
                    },
                    readonly: { type: 'boolean', description: 'Disable all edits (default: false)' },
                    today_button: { type: 'boolean', description: 'Show today button (default: true)' },
                    popup_on: { type: 'string', enum: ['click', 'hover'], description: 'When to show popup' },
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
          // Generate HTML
          const html = GanttHTMLGenerator.generate(
            validatedInput.tasks as GanttTask[],
            validatedInput.options
          );

          // Build response text
          let responseText = `✅ Gantt diagram generated successfully!\n\n`;
          responseText += `📊 Tasks: ${validatedInput.tasks.length}\n`;

          if (validationResult.warnings.length > 0) {
            responseText += `\n⚠️  Warnings:\n`;
            validationResult.warnings.forEach((w: any) => {
              responseText += `  • ${w.message}\n`;
            });
          }

          responseText += `\n📝 Interactive Gantt chart ready to display.`;

          result = {
            isError: false,
            content: [
              {
                type: 'text',
                text: responseText,
              },
              {
                type: 'html',
                text: html,
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
 * API endpoint to create Gantt diagram
 */
app.post('/api/gantt', (req: Request, res: Response) => {
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

    // Generate HTML
    const html = GanttHTMLGenerator.generate(tasks as GanttTask[], options as GanttOptions);

    // Return successful response
    res.json({
      success: true,
      taskCount: tasks.length,
      warnings: validationResult.warnings.length > 0 ? validationResult.warnings : null,
      html: html,
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
        },
        {
          id: '2',
          name: 'Design Phase',
          start: '2024-01-05',
          end: '2024-01-15',
          progress: 80,
          dependencies: '1',
        },
        {
          id: '3',
          name: 'Development',
          start: '2024-01-15',
          end: '2024-02-01',
          progress: 30,
          dependencies: '2',
        },
        {
          id: '4',
          name: 'Testing',
          start: '2024-02-01',
          end: '2024-02-10',
          progress: 0,
          dependencies: '3',
        },
      ],
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
        },
      ],
      options: {
        view_mode: 'Week',
      },
    },
    withDependencies: {
      tasks: [
        { id: '1', name: 'Foundation', start: '2024-01-01', end: '2024-01-10', progress: 100 },
        { id: '2', name: 'Layer A', start: '2024-01-10', end: '2024-01-20', progress: 80, dependencies: '1' },
        { id: '3', name: 'Layer B', start: '2024-01-10', end: '2024-01-20', progress: 70, dependencies: '1' },
        { id: '4', name: 'Assembly', start: '2024-01-20', end: '2024-01-30', progress: 0, dependencies: '2,3' },
      ],
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
  console.log(`   GET /health - Health check`);
});
