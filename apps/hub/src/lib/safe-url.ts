import { lookup } from 'node:dns/promises'

const PRIVATE_IP_PATTERNS = [
    /^127\./,                        // loopback
    /^10\./,                         // RFC 1918 Class A
    /^172\.(1[6-9]|2\d|3[01])\./,   // RFC 1918 Class B
    /^192\.168\./,                   // RFC 1918 Class C
    /^169\.254\./,                   // link-local
    /^0\.0\.0\.0/,                   // any
    /^::1$/,                         // IPv6 loopback
    /^\[::1\]$/,
    /^fc[0-9a-f]{2}:/i,              // IPv6 ULA
    /^fd[0-9a-f]{2}:/i,
]

function isPrivateIp(address: string): boolean {
    return PRIVATE_IP_PATTERNS.some(p => p.test(address.toLowerCase()))
}

/**
 * Validates that a URL is safe to fetch from the hub — i.e. it points to a
 * publicly reachable host and not an internal/private address.
 *
 * Two-stage check:
 *   1. Parse and reject non-http(s) schemes and known-private hostname strings
 *   2. Resolve DNS and reject any resolved IP that falls in a private range
 *      (mitigates DNS rebinding: an attacker can't pass validation by pointing
 *       to a public hostname that later rebinds to 127.0.0.1)
 */
export async function isSafeUrl(rawUrl: string): Promise<boolean> {
    try {
        const u = new URL(rawUrl)
        if (!['http:', 'https:'].includes(u.protocol)) return false

        const hostname = u.hostname.toLowerCase()

        // Stage 1: hostname-level rejects (fast path for obvious cases)
        if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false
        if (isPrivateIp(hostname)) return false

        // Stage 2: resolve and validate all returned IPs
        const results = await lookup(hostname, { all: true })
        for (const { address } of results) {
            if (isPrivateIp(address)) return false
        }

        return true
    } catch {
        // DNS failure, malformed URL, etc. — treat as unsafe
        return false
    }
}
