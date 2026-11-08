# syntax=docker/dockerfile:1
# AI Assistance Disclosure:
# Tool: Codex (model: GPT-6), date: 2026-11-07
# Scope: Docker scaffold following existing order/supplier service conventions.
# No requirements, architecture, schema, or API decisions were made by the AI tool.
# Author review: tng wen xi

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["sh", "-c", "npm run db:generate && npm run db:deploy && exec npm run dev"]

FROM deps AS build
COPY . .
RUN npm run db:generate && npm run build && npm prune --omit=dev

FROM base AS production
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./
USER node
EXPOSE 3000
CMD ["sh", "-c", "npm run db:deploy && exec npm start"]
