FROM oven/bun:alpine

ENV NODE_ENV=production
ENV DATABASE_URL="file:../config/db.sqlite"

WORKDIR /app

RUN apk add --no-cache openssl \
    && rm -rf /root/.cache /tmp/*

# Copy dependency files first for better caching
COPY package.json bun.lock* ./
COPY prisma ./prisma

# Install production dependencies + generate Prisma client
RUN sed -i 's/"prepare": ".*"/"prepare": ""/' package.json \
    && bun install --production --frozen-lockfile \
    && bunx prisma generate \
    && rm -rf /root/.bun/install/cache

# Copy source code and config
COPY src ./src
COPY tsconfig.json ./

# Copy entrypoint script
COPY docker/entrypoint.sh /app/docker/entrypoint.sh
RUN chmod +x /app/docker/entrypoint.sh

ENTRYPOINT ["/app/docker/entrypoint.sh"]
