#!/bin/sh
set -e

echo "Pushing database schema..."
bun run db:push

echo "Starting Perch hub..."
exec bun run src/index.ts