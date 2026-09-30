# ==============================================================================
# MitFloww Scheduler - Multi-Stage Production Dockerfile
# ==============================================================================

# Stage 1: Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@12.8.1 --activate

# Copy package descriptors
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and configs
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to ESM bundle in dist/
RUN pnpm run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install tini for clean UNIX signal handling (SIGTERM, SIGINT) and wget for healthchecks
RUN apk add --no-cache tini wget

# Install pnpm
RUN corepack enable && corepack prepare pnpm@12.8.1 --activate

# Copy package descriptors and install only production dependencies
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy compiled JavaScript bundle from builder stage
COPY --from=builder /app/dist ./dist

# Create logs directory and ensure non-root permissions
RUN mkdir -p /app/logs && chown -R node:node /app

USER node

# Expose internal health probe port
EXPOSE 4002

# Health check configuration for Docker / Orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4002/health || exit 1

# Entrypoint wraps Node process with tini to ensure signal propagation
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
