# syntax=docker/dockerfile:1
#
# AI Assistance Disclosure:
# Tool: GitHub Copilot (model: GPT-5.6 Luna), date: 2026-10-16
# Scope: Added the frontend development container used by the root Compose
#        development override. No requirements, architecture, schema, or API
#        decisions were made by the AI tool.
# Author review: tng wen xi

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
