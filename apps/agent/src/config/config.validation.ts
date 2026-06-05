const required = (key: string): string => {
    const value = Bun.env[key]
    if (!value) throw new Error(`Missing required environment variable: ${key}`);
    return value;
};

export const config = {
    hubUrl: required('PERCH_HUB_URL'),
    hubToken: required('PERCH_HUB_TOKEN'),
    interval: parseInt(Bun.env.PERCH_INTERVAL ?? '5000'),
    agentIdFile: Bun.env.PERCH_AGENT_ID_FILE ?? './agent.id',
};