import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './src/db/migrations',
    dialect: 'postgresql',
    dbCredentials: {
        host: Bun.env.PERCH_DB_HOST ?? 'localhost',
        port: parseInt(Bun.env.PERCH_DB_PORT ?? '5432'),
        user: Bun.env.PERCH_DB_USER ?? 'perch',
        password: Bun.env.PERCH_DB_PASS ?? '',
        database: Bun.env.PERCH_DB_NAME ?? 'perch',
    },
})