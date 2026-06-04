import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { healthChecks, healthCheckResults } from '../db/schema'
import { healthChecker } from '../services/health-checker'

export const healthCheckRoutes = new Elysia({ prefix: '/api/health-checks' })
  .get('/', () => db.select().from(healthChecks))
  .post('/', async ({ body }) => {
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
  .get('/:id/history', ({ params }) =>
    db.select()
      .from(healthCheckResults)
      .where(eq(healthCheckResults.healthCheckId, params.id))
      .orderBy(healthCheckResults.checkedAt)
  )
  .patch('/:id', async ({ params, body }) => {
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
  .delete('/:id', async ({ params }) => {
    healthChecker.cancel(params.id)
    await db.delete(healthChecks).where(eq(healthChecks.id, params.id))
    return { success: true }
  })