import { readFileSync } from 'node:fs'

// Resolve an env var, preferring the Docker-secret convention: if PERCH_FOO_FILE
// is set, read the value from that file; otherwise fall back to PERCH_FOO.
const readEnv = (key: string): string | undefined => {
    const filePath = Bun.env[`${key}_FILE`]
    if (filePath) return readFileSync(filePath, 'utf8').trim()
    return Bun.env[key]
};

const required = (key: string): string => {
    const value = readEnv(key)
    if (!value) throw new Error(`Missing required environment variable: ${key} (or ${key}_FILE)`);
    return value;
};

export const config = {
    hubUrl: required('PERCH_HUB_URL'),
    hubToken: required('PERCH_HUB_TOKEN'),
    interval: parseInt(readEnv('PERCH_INTERVAL') ?? '5000'),
    agentIdFile: readEnv('PERCH_AGENT_ID_FILE') ?? './agent.id',
};