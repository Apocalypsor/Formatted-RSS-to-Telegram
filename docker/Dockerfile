# Build stage
FROM oven/bun:alpine AS builder

WORKDIR /app

# Copy only dependency files first for better caching
COPY package.json bun.lockb* ./
COPY prisma ./prisma
COPY scripts ./scripts

# Install all dependencies (including dev dependencies for build)
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build the application
RUN NODE_ENV=production bun run build

# Production stage
FROM oven/bun:alpine

ENV NODE_ENV=production
ENV DATABASE_URL="file:../config/db.sqlite"

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/package.json /app/bun.lockb* ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Install only production dependencies
RUN bun install --production --frozen-lockfile \
    && rm -rf /root/.bun/install/cache

# Copy entrypoint script
COPY docker/entrypoint.sh /app/docker/entrypoint.sh
RUN chmod +x /app/docker/entrypoint.sh

ENTRYPOINT ["/app/docker/entrypoint.sh"]
