# AI Assistance Disclosure:
# Tool: Codex (model: gpt-5.6-luna), date: 2026-09-28
# Scope: Phase 0 Task 1 project scaffold configuration; no decisions made.
# Author review:
FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 3002

FROM base AS dev
CMD ["npm", "run", "dev"]

FROM base AS prod
RUN npm run build
CMD ["node", "dist/app.js"]
