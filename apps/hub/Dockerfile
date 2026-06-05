FROM oven/bun:1 AS web-builder

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/hub/package.json ./apps/hub/package.json
COPY apps/agent/package.json ./apps/agent/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN bun install --frozen-lockfile

COPY packages/types ./packages/types
COPY apps/web ./apps/web

RUN bun --cwd apps/web run build

FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/hub/package.json ./apps/hub/package.json
COPY apps/agent/package.json ./apps/agent/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN bun install --frozen-lockfile

COPY packages/types ./packages/types
COPY apps/hub ./apps/hub

COPY --from=web-builder /app/apps/web/dist ./apps/web/dist

WORKDIR /app/apps/hub

RUN chmod +x docker-entrypoint.sh

EXPOSE 8484
ENTRYPOINT ["./docker-entrypoint.sh"]
