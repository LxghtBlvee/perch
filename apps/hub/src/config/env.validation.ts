const required = (key: string): string => {
    const value = Bun.env[key]
    if (!value) throw new Error(`Missing required environment variable: ${key}`)
        return value
};

export const env = {
    port: parseInt(Bun.env.PERCH_PORT ?? '8484'),
    hubToken: required('PERCH_HUB_TOKEN'),
    db: {
        host: Bun.env.PERCH_DB_HOST ?? 'localhost',
        port: parseInt(Bun.env.PERCH_DB_PORT ?? '5432'),
        user: required('PERCH_DB_USER'),
        pass: required('PERCH_DB_PASS'),
        name: Bun.env.PERCH_DB_NAME ?? 'perch',
    },
    // Optional: seed first admin on startup if no users exist
    adminEmail: Bun.env.PERCH_ADMIN_EMAIL,
    adminPassword: Bun.env.PERCH_ADMIN_PASSWORD,
    // Session expiry in days (default 30)
    sessionDays: parseInt(Bun.env.PERCH_SESSION_DAYS ?? '30'),
    // Optional: explicit base URL for OAuth callbacks (e.g. https://metrics.example.com)
    // If set, takes priority over x-forwarded-proto/host headers
    baseUrl: Bun.env.PERCH_BASE_URL,
}