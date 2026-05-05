import { GanttTask, GanttOptions } from '../types.js';

/**
 * Generates self-contained HTML with Frappe Gantt chart
 */
export class GanttHTMLGenerator {
  /**
   * Generate complete HTML with embedded Gantt diagram
   */
  static generate(tasks: GanttTask[], options?: GanttOptions): string {
    const opts = this.mergeOptions(options);
    const tasksJson = JSON.stringify(tasks, null, 2);
    const optionsJson = JSON.stringify(opts, null, 2);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gantt Diagram</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/frappe-gantt/dist/frappe-gantt.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #333;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 28px;
            margin-bottom: 8px;
            font-weight: 600;
        }

        .header p {
            font-size: 14px;
            opacity: 0.9;
        }

        .content {
            padding: 30px;
        }

        #gantt-container {
            background: #fafafa;
            border-radius: 6px;
            overflow-x: auto;
            overflow-y: hidden;
        }

        /* Frappe Gantt customizations */
        .svg_container svg {
            background: #fafafa;
        }

        .bar {
            fill: #667eea;
            stroke: #555;
        }

        .bar.critical {
            fill: #ef5350;
        }

        .bar.high-priority {
            fill: #ff9800;
        }

        .bar.medium-priority {
            fill: #667eea;
        }

        .bar.low-priority {
            fill: #66bb6a;
        }

        .bar.progress {
            fill: #764ba2;
            opacity: 0.8;
        }

        .task-details {
            background: #f9f9f9;
            padding: 20px;
            margin-top: 20px;
            border-radius: 6px;
            border-left: 4px solid #667eea;
        }

        .task-details h3 {
            font-size: 16px;
            margin-bottom: 10px;
            color: #667eea;
        }

        .task-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
        }

        .task-item {
            background: white;
            border: 1px solid #e0e0e0;
            padding: 12px;
            border-radius: 4px;
            font-size: 12px;
        }

        .task-item strong {
            color: #667eea;
            display: block;
            margin-bottom: 4px;
        }

        .task-item .task-meta {
            color: #666;
            line-height: 1.6;
        }

        .footer {
            background: #f9f9f9;
            padding: 15px 30px;
            text-align: center;
            font-size: 12px;
            color: #888;
            border-top: 1px solid #e0e0e0;
        }

        .info-box {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
            color: #1565c0;
            font-size: 13px;
        }

        .info-box strong {
            display: block;
            margin-bottom: 5px;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .header {
                padding: 20px;
            }

            .header h1 {
                font-size: 22px;
            }

            .content {
                padding: 15px;
            }

            .task-list {
                grid-template-columns: 1fr;
            }
        }

        /* Print styles */
        @media print {
            body {
                background: white;
                padding: 0;
            }

            .container {
                box-shadow: none;
                border-radius: 0;
            }

            .header {
                background: #f5f5f5;
                color: black;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Gantt Diagram</h1>
            <p>Interactive project timeline - created with Frappe Gantt</p>
        </div>

        <div class="content">
            <div class="info-box">
                <strong>💡 Tip:</strong> Use the timeline controls to change view mode (Day/Week/Month/Year). Drag tasks to reschedule them, or adjust the progress bar.
            </div>

            <div id="gantt-container"></div>

            <div class="task-details">
                <h3>📋 Task Overview (${tasks.length} tasks)</h3>
                <div class="task-list">
                    ${tasks.map(task => this.generateTaskHtml(task)).join('')}
                </div>
            </div>
        </div>

        <div class="footer">
            <p>Generated with MCP Gantt Server • Powered by Frappe Gantt • ${new Date().toLocaleString()}</p>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/frappe-gantt/dist/frappe-gantt.umd.js"></script>
    <script>
        // Task data
        const tasks = ${tasksJson};
        
        // Gantt options
        const options = ${optionsJson};

        // Create Gantt instance
        try {
            const gantt = new Gantt("#gantt-container", tasks, options);
            console.log('Gantt chart rendered successfully', tasks.length, 'tasks');
        } catch (error) {
            console.error('Error rendering Gantt chart:', error);
            document.getElementById('gantt-container').innerHTML = 
                '<div style="color: red; padding: 20px;">Error rendering Gantt chart: ' + error.message + '</div>';
        }
    </script>
</body>
</html>`;
  }

  /**
   * Generate HTML for a single task item
   */
  private static generateTaskHtml(task: GanttTask): string {
    const progress = task.progress ?? 0;
    const deps = task.dependencies ? task.dependencies.split(',').map(d => d.trim()).join(', ') : 'None';

    return `
        <div class="task-item">
            <strong>${task.name}</strong>
            <div class="task-meta">
                <div><strong>ID:</strong> ${this.escapeHtml(task.id)}</div>
                <div><strong>Duration:</strong> ${task.start} to ${task.end}</div>
                <div><strong>Progress:</strong> ${progress}%</div>
                <div style="width: 100%; background: #e0e0e0; height: 4px; border-radius: 2px; margin-top: 4px; overflow: hidden;">
                    <div style="width: ${progress}%; height: 100%; background: #667eea; transition: width 0.3s;"></div>
                </div>
                ${task.priority ? `<div><strong>Priority:</strong> <span style="color: ${this.getPriorityColor(task.priority)}">${task.priority.toUpperCase()}</span></div>` : ''}
                ${task.resource ? `<div><strong>Resource:</strong> ${this.escapeHtml(task.resource)}</div>` : ''}
                ${task.dependencies ? `<div><strong>Depends on:</strong> ${this.escapeHtml(deps)}</div>` : ''}
            </div>
        </div>
    `;
  }

  /**
   * Get color for priority level
   */
  private static getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high':
        return '#d32f2f';
      case 'medium':
        return '#f57c00';
      case 'low':
        return '#388e3c';
      default:
        return '#666';
    }
  }

  /**
   * Escape HTML special characters
   */
  private static escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  /**
   * Merge user options with defaults
   */
  private static mergeOptions(userOptions?: GanttOptions): any {
    const defaults = {
      view_mode: 'Month',
      view_mode_select: true,
      column_width: 45,
      bar_height: 30,
      bar_corner_radius: 3,
      arrow_curve: 5,
      popup_on: 'click',
      today_button: true,
      date_format: 'YYYY-MM-DD',
    };

    return { ...defaults, ...userOptions };
  }
}
