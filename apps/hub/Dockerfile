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

WORKDIR /app/apps/hub

RUN chmod +x docker-entrypoint.sh

EXPOSE 8484
ENTRYPOINT ["./docker-entrypoint.sh"]