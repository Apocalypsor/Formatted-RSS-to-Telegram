# Build stage
FROM oven/bun:alpine AS builder

WORKDIR /app

COPY package.json bun.lock* ./

RUN sed -i 's/"prepare": ".*"/"prepare": ""/' package.json \
    && bun install --frozen-lockfile

COPY src ./src
COPY tsconfig.json ./

RUN NODE_ENV=production bun build --compile --minify --target=bun src/index.ts --outfile dist/fr2t

# Production stage
FROM alpine:latest

ENV NODE_ENV=production
ENV DATABASE_URL="file:./config/db.sqlite"

WORKDIR /app

RUN apk add --no-cache libstdc++ libgcc

# Copy binary and migration files
COPY --from=builder /app/dist/fr2t ./fr2t
COPY drizzle ./drizzle

# Copy entrypoint script
COPY docker/entrypoint.sh /app/docker/entrypoint.sh
RUN chmod +x /app/docker/entrypoint.sh

ENTRYPOINT ["/app/docker/entrypoint.sh"]
