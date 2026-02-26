# ─── Build stage ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies first (layer-cached unless package files change)
COPY package*.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY . .
RUN npm run build

# ─── Production stage ───────────────────────────────────────────────────────
FROM node:20-slim

# Install system dependencies required by Playwright/Chromium
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled output and production node_modules from builder
COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Install Playwright's Chromium browser into the production image
# PLAYWRIGHT_BROWSERS_PATH controls where browsers are stored
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium

# Copy SQL seed files so the app can reference them at runtime
COPY src/db/schema.sql ./dist/db/schema.sql
COPY src/db/seed.sql   ./dist/db/seed.sql

# Non-root user for security
RUN groupadd --gid 1001 nodejs \
 && useradd  --uid 1001 --gid nodejs --shell /bin/bash --create-home nodeuser \
 && chown -R nodeuser:nodejs /app /ms-playwright
USER nodeuser

EXPOSE 3001

CMD ["node", "dist/app.js"]
