import { lookup } from 'node:dns/promises'

// IPv4 CIDR blocks that must never be reachable from the hub: loopback, RFC 1918
// private space, link-local (incl. cloud metadata 169.254.169.254), CGNAT, and the
// various reserved/special-use ranges that can front internal services.
const BLOCKED_V4_CIDRS: ReadonlyArray<readonly [string, number]> = [
    ['0.0.0.0', 8],          // "this" network / unspecified
    ['10.0.0.0', 8],         // RFC 1918
    ['100.64.0.0', 10],      // RFC 6598 CGNAT
    ['127.0.0.0', 8],        // loopback
    ['169.254.0.0', 16],     // link-local (cloud metadata lives here)
    ['172.16.0.0', 12],      // RFC 1918
    ['192.0.0.0', 24],       // IETF protocol assignments
    ['192.0.2.0', 24],       // TEST-NET-1
    ['192.168.0.0', 16],     // RFC 1918
    ['198.18.0.0', 15],      // benchmarking
    ['198.51.100.0', 24],    // TEST-NET-2
    ['203.0.113.0', 24],     // TEST-NET-3
    ['224.0.0.0', 4],        // multicast
    ['240.0.0.0', 4],        // reserved (incl. 255.255.255.255)
]

function ipv4ToInt(ip: string): number | null {
    const parts = ip.split('.')
    if (parts.length !== 4) return null
    let n = 0
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) return null
        const octet = Number(part)
        if (octet > 255) return null
        n = (n << 8) | octet
    }
    return n >>> 0
}

function isBlockedIpv4(ip: string): boolean {
    const addr = ipv4ToInt(ip)
    if (addr === null) return false
    return BLOCKED_V4_CIDRS.some(([base, bits]) => {
        const baseInt = ipv4ToInt(base)!
        const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
        return (addr & mask) === (baseInt & mask)
    })
}

function isBlockedIpv6(ip: string): boolean {
    const v = ip
    if (v === '::1' || v === '::') return true       // loopback / unspecified
    if (/^f[cd][0-9a-f]{2}:/.test(v)) return true    // fc00::/7 unique-local
    if (/^fe[89ab][0-9a-f]:/.test(v)) return true    // fe80::/10 link-local
    if (/^fec[0-9a-f]:/.test(v)) return true         // fec0::/10 deprecated site-local
    if (/^ff[0-9a-f]{2}:/.test(v)) return true       // ff00::/8 multicast
    return false
}

/**
 * True if the given IP literal points at a private/internal/reserved address.
 * Normalises bracketed forms, IPv6 zone ids, and IPv4-mapped IPv6 (::ffff:a.b.c.d)
 * so those can't be used to smuggle an internal IPv4 past the IPv4 checks.
 */
function isPrivateAddress(address: string): boolean {
    let addr = address.toLowerCase().trim().replace(/^\[|\]$/g, '').split('%')[0]

    // IPv4-mapped IPv6 — treat as the embedded IPv4 (covers ::ffff:127.0.0.1)
    const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    if (mapped) return isBlockedIpv4(mapped[1])

    if (addr.includes(':')) return isBlockedIpv6(addr)
    return isBlockedIpv4(addr)
}

/**
 * Validates that a URL is safe to fetch from the hub — i.e. it points to a
 * publicly reachable host and not an internal/private address.
 *
 * Two-stage check:
 *   1. Parse and reject non-http(s) schemes and known-private hostname strings
 *   2. Resolve DNS and reject any resolved IP that falls in a private range
 *
 * NOTE: validation and the eventual fetch resolve DNS independently, so this
 * check on its own does not stop DNS rebinding or redirect-based SSRF. Always
 * fetch user-supplied URLs through {@link safeFetch}, which re-validates the
 * target host on every redirect hop.
 */
export async function isSafeUrl(rawUrl: string): Promise<boolean> {
    try {
        const u = new URL(rawUrl)
        if (!['http:', 'https:'].includes(u.protocol)) return false

        const hostname = u.hostname.toLowerCase()

        // Stage 1: hostname-level rejects (fast path for obvious cases)
        if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false
        if (isPrivateAddress(hostname)) return false

        // Stage 2: resolve and validate all returned IPs
        const results = await lookup(hostname, { all: true })
        if (results.length === 0) return false
        for (const { address } of results) {
            if (isPrivateAddress(address)) return false
        }

        return true
    } catch {
        // DNS failure, malformed URL, etc. — treat as unsafe
        return false
    }
}

const MAX_REDIRECTS = 5

/**
 * SSRF-safe fetch for user-supplied URLs. Validates the target with
 * {@link isSafeUrl} before every request and follows redirects manually so each
 * hop's host is re-validated — an attacker can't pass validation with a public
 * URL that then 3xx-redirects to an internal address. Pass the same `init` you'd
 * give `fetch` (e.g. an AbortSignal for the overall timeout).
 */
export async function safeFetch(
    rawUrl: string,
    init: RequestInit = {},
    maxRedirects: number = MAX_REDIRECTS,
): Promise<Response> {
    let currentUrl = rawUrl
    for (let hop = 0; hop <= maxRedirects; hop++) {
        if (!await isSafeUrl(currentUrl)) {
            throw new Error('Blocked request to a private or disallowed address')
        }
        const res = await fetch(currentUrl, { ...init, redirect: 'manual' })
        if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get('location')
            if (!location) return res
            currentUrl = new URL(location, currentUrl).toString()
            continue
        }
        return res
    }
    throw new Error('Too many redirects')
}
