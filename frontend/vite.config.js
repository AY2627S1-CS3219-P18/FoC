/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Added the development proxy from /api/v1 to the supplier service and /auth, /users to the user service. No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Development stand-in for the single API gateway: the browser only ever talks to this origin, so no
  // CORS is involved (SupplierServiceArchitecture.md §3, §9 item 18). Ports are the compose published ports.
  server: {
    proxy: {
      '/api/v1': 'http://localhost:3004', // supplier service
      '/auth': 'http://localhost:3001', // user service
      '/users': 'http://localhost:3001', // user service
    },
  },
})
