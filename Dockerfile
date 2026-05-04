# ==========================================
# Stage 1 — Dependency builder
# Compiles better-sqlite3 native bindings
# ==========================================
FROM node:22-alpine AS deps

# Native build tools required for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci


# ==========================================
# Stage 2 — Runtime image
# ==========================================
FROM node:22-alpine AS runtime

WORKDIR /app

# Copy native-compiled node_modules from builder stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Persistent data directories — these are overridden by Docker volumes at runtime
# so the directories just need to exist in the image
RUN mkdir -p /app/data /app/audit_logs

ENV NODE_ENV=production

CMD ["node_modules/.bin/tsx", "core/bot.ts"]
