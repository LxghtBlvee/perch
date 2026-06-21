import { readFileSync } from 'node:fs'

// Resolve an env var, preferring the Docker-secret convention: if PERCH_FOO_FILE
// is set, read the value from that file; otherwise fall back to PERCH_FOO. Lets
// Swarm/Compose secrets be mounted as files without leaking them into the env.
const readEnv = (key: string): string | undefined => {
    const filePath = Bun.env[`${key}_FILE`]
    if (filePath) return readFileSync(filePath, 'utf8').trim()
    return Bun.env[key]
}

const required = (key: string): string => {
    const value = readEnv(key)
    if (!value) throw new Error(`Missing required environment variable: ${key} (or ${key}_FILE)`)
        return value
};

export const env = {
    port: parseInt(readEnv('PERCH_PORT') ?? '8484'),
    hubToken: required('PERCH_HUB_TOKEN'),
    db: {
        host: readEnv('PERCH_DB_HOST') ?? 'localhost',
        port: parseInt(readEnv('PERCH_DB_PORT') ?? '5432'),
        user: required('PERCH_DB_USER'),
        pass: required('PERCH_DB_PASS'),
        name: readEnv('PERCH_DB_NAME') ?? 'perch',
    },
    // Optional: seed first admin on startup if no users exist
    adminEmail: readEnv('PERCH_ADMIN_EMAIL'),
    adminPassword: readEnv('PERCH_ADMIN_PASSWORD'),
    // Session expiry in days (default 30)
    sessionDays: parseInt(readEnv('PERCH_SESSION_DAYS') ?? '30'),
    // Optional: explicit base URL for OAuth callbacks (e.g. https://metrics.example.com)
    // If set, takes priority over x-forwarded-proto/host headers
    baseUrl: readEnv('PERCH_BASE_URL'),
}

// Warn loudly at startup if PERCH_BASE_URL is missing in production
if (!env.baseUrl && Bun.env.NODE_ENV === 'production') {
    console.warn(
        '[WARN] PERCH_BASE_URL is not set. OAuth callback URLs will be derived from ' +
        'x-forwarded-host headers, which can be spoofed if the hub is reachable directly. ' +
        'Set PERCH_BASE_URL=https://your-domain.com in production.'
    )
}