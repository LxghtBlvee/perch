import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { healthChecks, healthCheckResults } from '../db/schema'
import { healthChecker } from '../services/health-checker'
import { requireAuthUser } from '../middleware/auth'

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

function isSafeUrl(rawUrl: string): boolean {
    try {
        const u = new URL(rawUrl)
        if (!['http:', 'https:'].includes(u.protocol)) return false
        const hostname = u.hostname.toLowerCase()
        if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false
        if (PRIVATE_IP_PATTERNS.some(p => p.test(hostname))) return false
        return true
    } catch {
        return false
    }
}

export const healthCheckRoutes = new Elysia({ prefix: '/api/health-checks' })
  .get('/', async ({ request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    return db.select().from(healthChecks)
  })
  .post('/', async ({ body, request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    if (!isSafeUrl(body.url)) { set.status = 400; return { error: 'URL must be a publicly accessible http/https address' } }
    const [check] = await db.insert(healthChecks).values(body).returning()
    healthChecker.schedule(check.id, check.interval)
    return check
  }, {
    body: t.Object({
      name: t.String(),
      url: t.String(),
      interval: t.Number({ default: 60 }),
    }),
  })
  .get('/:id/history', async ({ params, request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    return db.select()
      .from(healthCheckResults)
      .where(eq(healthCheckResults.healthCheckId, params.id))
      .orderBy(healthCheckResults.checkedAt)
  })
  .patch('/:id', async ({ params, body, request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    if (body.url !== undefined && !isSafeUrl(body.url)) { set.status = 400; return { error: 'URL must be a publicly accessible http/https address' } }
    const [check] = await db
      .update(healthChecks)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(healthChecks.id, params.id))
      .returning()
    if (check && body.interval) healthChecker.schedule(check.id, check.interval)
    return check
  }, {
    body: t.Partial(
      t.Object({
        name: t.String(),
        url: t.String(),
        interval: t.Number(),
      })
    ),
  })
  .delete('/:id', async ({ params, request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    healthChecker.cancel(params.id)
    await db.delete(healthChecks).where(eq(healthChecks.id, params.id))
    return { success: true }
  })
