import { eq } from 'drizzle-orm'
import { db } from '../db'
import { healthChecks, healthCheckResults } from '../db/schema'
import { liveRegistry } from './live-registry'
import type { HealthCheck } from '@perch/types'

class HealthChecker {
    private intervals = new Map<string, ReturnType<typeof setInterval>>()

    async start(): Promise<void> {
        const checks = await db.select().from(healthChecks)
        for (const check of checks) {
            this.schedule(check.id, check.interval)
        }
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

        const start = Date.now()
        let status: 'up' | 'down' = 'down'
        let latency: number | null = null
        
        try {
            const res = await fetch(check.url, { signal: AbortSignal.timeout(10_000) })
            if (res.ok) {
                status = 'up'
                latency = Date.now() - start
            }
        } catch {
            status = 'down'
        }

        await db.insert(healthCheckResults).values({ healthCheckId: id, status, latency })

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