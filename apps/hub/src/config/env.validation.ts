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
}