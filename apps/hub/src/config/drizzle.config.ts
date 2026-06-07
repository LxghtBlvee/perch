import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './src/db/migrations',
    dialect: 'postgresql',
    dbCredentials: {
        host: process.env.PERCH_DB_HOST ?? 'localhost',
        port: parseInt(process.env.PERCH_DB_PORT ?? '5432'),
        user: process.env.PERCH_DB_USER ?? 'perch',
        password: process.env.PERCH_DB_PASS ?? '',
        database: process.env.PERCH_DB_NAME ?? 'perch',
    },
})