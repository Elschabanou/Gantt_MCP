import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  Tool,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createGanttDiagramTool } from './tools/generate-gantt.js';
import { GanttValidator } from './utils/task-validator.js';
import { GanttHTMLGenerator } from './utils/html-generator.js';
import { CreateGanttToolSchema } from './tools/schemas.js';
import { GanttTask } from './types.js';

/**
 * Initialize MCP Server for Gantt diagram generation
 * This version is designed for HTTP transport (cloud-hosted)
 */
export function createMCPServer() {
  const server = new Server({
    name: 'mcp-gantt-server',
    version: '1.0.0',
  });

  /**
   * Handler for tools/list - List available tools
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [createGanttDiagramTool()],
    };
  });

  /**
   * Handler for tools/call - Execute a tool
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name !== 'create_gantt_diagram') {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Unknown tool: ${name}`,
          },
        ],
      };
    }

    try {
      // Validate input schema
      const validatedInput = CreateGanttToolSchema.parse(args);

      // Validate tasks
      const validator = new GanttValidator();
      const validationResult = validator.validate(validatedInput.tasks as GanttTask[]);

      if (!validationResult.valid) {
        const errorMessages = validationResult.errors
          .map((e) => `[${e.taskId}] ${e.field}: ${e.message}`)
          .join('\n');

        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Validation failed:\n\n${errorMessages}`,
            },
          ],
        };
      }

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
        validationResult.warnings.forEach((w) => {
          responseText += `  • ${w.message}\n`;
        });
      }

      responseText += `\n📝 Interactive Gantt chart ready to display.`;

      return {
        isError: false,
        content: [
          {
            type: 'text' as const,
            text: responseText,
          },
          {
            type: 'text' as const,
            text: html,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Error: ${errorMessage}\n\nEnsure your input follows this format:\n{\n  "tasks": [\n    {\n      "id": "1",\n      "name": "Task Name",\n      "start": "2024-01-01",\n      "end": "2024-01-15",\n      "progress": 50\n    }\n  ],\n  "options": {\n    "view_mode": "Month"\n  }\n}`,
          },
        ],
      };
    }
  });

  return server;
}
