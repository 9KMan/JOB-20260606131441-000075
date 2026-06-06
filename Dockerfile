# syntax=docker/dockerfile:1.6
# ─── Stage 1: install dependencies ────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# ─── Stage 2: build TypeScript ───────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
COPY migrations ./migrations
RUN npm run build

# ─── Stage 3: production runtime ─────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Bring only what's needed at runtime
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist          ./dist
COPY --from=build /app/migrations    ./migrations
COPY package.json ./

# Run as non-root
RUN addgroup -S app && adduser -S app -G app \
 && chown -R app:app /app
USER app

EXPOSE 3000

# Lightweight health probe — could be /health but we keep the entry
# simple to allow the container to be smoke-tested in any env.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/src/index.js"]
