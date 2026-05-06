/**
 * MCP Gantt Server - Entrypoint
 * 
 * This server is designed for HTTP/Cloud deployment.
 * For local development with Web-UI and testing, use: npm run dev
 * 
 * The main MCP HTTP endpoint is at: POST /mcp
 * Web-UI is at: GET / or http://localhost:3000
 * 
 * Force rebuild trigger v2
 */

import('./web/app.js').catch((error) => {
  console.error('Failed to start HTTP server:', error);
  process.exit(1);
});
