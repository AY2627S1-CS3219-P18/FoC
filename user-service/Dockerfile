# AI Assistance Disclosure:
# Tool: Claude Code (claude-sonnet-5), date: 2026-09-24
#   24/09/2026: Stage 3a - multi-stage Dockerfile (dev + prod)
#   Author review: No changes needed. 
#   26/09/2026: Stage 7 - prod CMD runs dist/server.js (app.ts no longer starts the server)
#   Author review:

FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 3001

FROM base AS dev
CMD ["npm", "run", "dev"]

FROM base AS prod
RUN npm run build
CMD ["node", "dist/server.js"]
