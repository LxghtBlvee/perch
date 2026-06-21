import { desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { healthChecks, healthCheckResults, instanceSettings } from '../db/schema'
import { liveRegistry } from './live-registry'
import { alertManager } from './alert-manager'
import { safeFetch } from '../lib/safe-url'
import { getUserAgent } from '../lib/version'
import type { HealthCheck } from '@perch/types'

const DEFAULT_TIMEOUT_MS = 10_000
const TIMEOUT_CACHE_TTL = 30_000

class HealthChecker {
    private intervals = new Map<string, ReturnType<typeof setInterval>>()
    // Cache the configured per-request timeout so we don't hit the DB on every run.
    private timeoutCache: { ms: number; fetchedAt: number } | null = null

    /** Configured per-request HTTP timeout (instance setting), cached briefly. */
    private async getTimeoutMs(): Promise<number> {
        if (this.timeoutCache && Date.now() - this.timeoutCache.fetchedAt < TIMEOUT_CACHE_TTL) {
            return this.timeoutCache.ms
        }
        const [settings] = await db
            .select({ timeout: instanceSettings.defaultHealthCheckTimeout })
            .from(instanceSettings)
            .where(eq(instanceSettings.id, 1))
            .limit(1)
        const ms = settings?.timeout ?? DEFAULT_TIMEOUT_MS
        this.timeoutCache = { ms, fetchedAt: Date.now() }
        return ms
    }

    async start(): Promise<void> {
        const checks = await db.select().from(healthChecks)
        for (const check of checks) {
            this.schedule(check.id, check.interval)
        }
    }

    /** Drop the cached timeout so the next run picks up a changed instance setting. */
    invalidateTimeoutCache(): void {
        this.timeoutCache = null
    }

    schedule(id: string, intervalSeconds: number): void {
        this.cancel(id)
        void this.run(id) // run immediately on schedule
        this.intervals.set(id, setInterval(() => this.run(id), intervalSeconds * 1000))
    }

    cancel(id: string): void {
        const timer = this.intervals.get(id)
        if (timer) {
            clearInterval(timer)
            this.intervals.delete(id)
        }
    }

    async run(id: string): Promise<void> {
        const [check] = await db.select().from(healthChecks).where(eq(healthChecks.id, id))
        if (!check) return 

        // Fetch previous result to detect transitions
        const [prevResult] = await db
            .select()
            .from(healthCheckResults)
            .where(eq(healthCheckResults.healthCheckId, id))
            .orderBy(desc(healthCheckResults.checkedAt))
            .limit(1)

        const start = Date.now()
        let status: 'up' | 'down' = 'down'
        let latency: number | null = null

        try {
            // safeFetch re-validates the target (and every redirect hop) so a
            // monitored URL can't be pointed at an internal/metadata address.
            // Identify ourselves so monitored services log "Perch Health Check"
            // rather than Bun's default User-Agent.
            const res = await safeFetch(check.url, {
                signal: AbortSignal.timeout(await this.getTimeoutMs()),
                headers: { 'User-Agent': await getUserAgent() },
            })
            if (res.ok) {
                status = 'up'
                latency = Date.now() - start
            }
        } catch {
            status = 'down'
        }

        await db.insert(healthCheckResults).values({ healthCheckId: id, status, latency })

        // Fire alert on transitions, or on first ever check only if it's already down
        const prevStatus = prevResult?.status ?? null
        if (prevStatus !== status && (prevStatus !== null || status === 'down')) {
            void alertManager.fireHealthCheckAlert(id, check.name, check.url, status)
        }

        const result: HealthCheck = {
            id: check.id,
            name: check.name,
            url: check.url,
            interval: check.interval,
            status,
            lastChecked: new Date().toISOString(),
            latency,
        }

        liveRegistry.broadcast({ type: 'health_check_update', healthCheck: result })
    }
}

export const healthChecker = new HealthChecker();