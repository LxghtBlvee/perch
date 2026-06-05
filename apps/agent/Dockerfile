FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/hub/package.json ./apps/hub/package.json
COPY apps/agent/package.json ./apps/agent/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN bun install --frozen-lockfile

COPY packages/types ./packages/types
COPY apps/agent ./apps/agent

WORKDIR /app/apps/agent
CMD ["bun", "run", "src/index.ts"]