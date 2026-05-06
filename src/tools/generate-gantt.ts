import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Tool definition for creating Gantt diagrams
 */
export function createGanttDiagramTool(): Tool {
  return {
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

Returns a static image preview of the Gantt chart ready to display.`,
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
  };
}
