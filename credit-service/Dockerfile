# AI Assistance Disclosure:
# Tool: Claude Code (model: claude-opus-5), date: 2026-09-26
#  2026-09-26: Recess iteration - multi-stage image, following user-service/Dockerfile
#    (same node:24-alpine base and dev/prod target names).
#    No requirements, architecture, schema, or API decisions were made by the AI tool.
#    Author review:

FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 3003

FROM base AS dev
CMD ["npm", "run", "dev"]

FROM base AS prod
RUN npm run build
CMD ["node", "dist/server.js"]
