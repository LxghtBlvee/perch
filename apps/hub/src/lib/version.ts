// Resolves the running Perch version and builds the outbound User-Agent.
//
// Source of truth, in order:
//   1. PERCH_VERSION env (e.g. set in docker-compose at release time)
//   2. The newest non-"latest" tag pushed to the lxghtblvee/perch-hub repo
//      on Docker Hub (cached for an hour to avoid hammering the registry)
//   3. "unknown" when both are unavailable

let versionCache: { tag: string; fetchedAt: number } | null = null
const VERSION_CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function resolveVersion(): Promise<string> {
    // Explicit env var wins (e.g. set in docker-compose as PERCH_VERSION)
    if (process.env.PERCH_VERSION) return process.env.PERCH_VERSION

    // Return cached value if still fresh
    if (versionCache && Date.now() - versionCache.fetchedAt < VERSION_CACHE_TTL) {
        return versionCache.tag
    }

    try {
        const res = await fetch(
            'https://hub.docker.com/v2/repositories/lxghtblvee/perch-hub/tags?page_size=20&ordering=last_updated',
        )
        if (!res.ok) throw new Error('Docker Hub error')
        const data = await res.json() as { results: Array<{ name: string }> }
        // First non-"latest" tag is the most recently pushed version tag
        const tag = data.results.find(t => t.name !== 'latest')?.name ?? 'unknown'
        versionCache = { tag, fetchedAt: Date.now() }
        return tag
    } catch {
        return 'unknown'
    }
}

/**
 * User-Agent for outbound health-check requests so monitored services see
 * "Perch Health Check/<version>" instead of Bun's default UA. Drops the version
 * suffix when it can't be resolved.
 */
export async function getUserAgent(): Promise<string> {
    const version = await resolveVersion()
    return version === 'unknown' ? 'Perch Health Check' : `Perch Health Check/${version}`
}
