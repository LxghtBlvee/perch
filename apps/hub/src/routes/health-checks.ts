import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { healthChecks, healthCheckResults, instanceSettings } from '../db/schema'
import { healthChecker } from '../services/health-checker'
import { requireAuthUser, requireAdminUser } from '../middleware/auth'
import { isSafeUrl } from '../lib/safe-url'

export const healthCheckRoutes = new Elysia({ prefix: '/api/health-checks' })
  .get('/', async ({ request, set }) => {
    const user = await requireAuthUser(request, set)
    if (!user) return { error: 'Unauthorized' }
    return db.select().from(healthChecks)
  })
  .post('/', async ({ body, request, set }) => {
    const user = await requireAdminUser(request, set)
    if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
    if (!await isSafeUrl(body.url)) { set.status = 400; return { error: 'URL must be a publicly accessible http/https address' } }
    // Fall back to the instance-wide default cadence when none was supplied.
    let interval = body.interval
    if (interval === undefined) {
      const [settings] = await db
        .select({ interval: instanceSettings.defaultHealthCheckInterval })
        .from(instanceSettings)
        .where(eq(instanceSettings.id, 1))
        .limit(1)
      interval = settings?.interval ?? 60
    }
    const [check] = await db.insert(healthChecks).values({ ...body, interval }).returning()
    healthChecker.schedule(check.id, check.interval)
    return check
  }, {
    body: t.Object({
      name: t.String(),
      url: t.String(),
      interval: t.Optional(t.Number()),
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
    const user = await requireAdminUser(request, set)
    if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
    if (body.url !== undefined && !await isSafeUrl(body.url)) { set.status = 400; return { error: 'URL must be a publicly accessible http/https address' } }
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
    const user = await requireAdminUser(request, set)
    if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
    healthChecker.cancel(params.id)
    await db.delete(healthChecks).where(eq(healthChecks.id, params.id))
    return { success: true }
  })
