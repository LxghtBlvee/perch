// Resolves the running Perch version and builds the outbound User-Agent.
//
// Source of truth, in order:
//   1. PERCH_VERSION env (e.g. set in docker-compose at release time)
//   2. The latest published GitHub release of LxghtBlvee/perch (cached an hour).
//      GitHub is the release source of truth, so this reflects the real version
//      (e.g. 1.3.10) — Docker Hub only carries moving major.minor tags.
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
            'https://api.github.com/repos/LxghtBlvee/perch/releases/latest',
            { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'perch-hub' } },
        )
        if (!res.ok) throw new Error('GitHub API error')
        const data = await res.json() as { tag_name?: string }
        // Normalise "v1.3.10" -> "1.3.10"
        const tag = data.tag_name?.replace(/^v/, '') || 'unknown'
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
