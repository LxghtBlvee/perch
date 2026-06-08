#!/bin/sh
set -e

echo "Applying database schema..."
bun run src/db/migrate.ts

echo "Starting Perch hub..."
exec bun run src/index.ts
