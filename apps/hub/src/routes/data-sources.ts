import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { dataSources } from '../db/schema'
import { requireAuthUser, requireAdminUser } from '../middleware/auth'
import { isSafeUrl } from '../lib/safe-url'

const dataSourceBody = t.Object({
    name: t.String({ minLength: 1 }),
    type: t.Union([
        t.Literal('prometheus'),
        t.Literal('loki'),
        t.Literal('influxdb'),
        t.Literal('graphite'),
    ]),
    url: t.String({ minLength: 1 }),
    isDefault: t.Optional(t.Boolean()),
})

export const dataSourceRoutes = new Elysia({ prefix: '/api/data-sources' })
    .get('/', async ({ request, set }) => {
        const user = await requireAuthUser(request, set)
        if (!user) return { error: 'Unauthorized' }
        return db.select().from(dataSources).orderBy(dataSources.createdAt)
    })

    .post('/', async ({ body, request, set }) => {
        const user = await requireAdminUser(request, set)
        if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
        if (!await isSafeUrl(body.url)) { set.status = 400; return { error: 'URL must be a publicly accessible http/https address' } }
        // If marking as default, clear existing default first
        if (body.isDefault) {
            await db.update(dataSources).set({ isDefault: false })
        }
        const [ds] = await db.insert(dataSources).values({
            name: body.name,
            type: body.type,
            url: body.url,
            isDefault: body.isDefault ?? false,
        }).returning()
        return ds
    }, { body: dataSourceBody })

    .patch('/:id', async ({ params, body, request, set }) => {
        const user = await requireAdminUser(request, set)
        if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
        if (body.url !== undefined && !await isSafeUrl(body.url)) { set.status = 400; return { error: 'URL must be a publicly accessible http/https address' } }
        if (body.isDefault) {
            await db.update(dataSources).set({ isDefault: false })
        }
        const [ds] = await db
            .update(dataSources)
            .set({ ...body, updatedAt: new Date() })
            .where(eq(dataSources.id, params.id))
            .returning()
        return ds
    }, { body: t.Partial(dataSourceBody) })

    .delete('/:id', async ({ params, request, set }) => {
        const user = await requireAdminUser(request, set)
        if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
        await db.delete(dataSources).where(eq(dataSources.id, params.id))
        return { success: true }
    })

    // Proxy: test connectivity to a data source
    .post('/:id/test', async ({ params, request, set }) => {
        const user = await requireAdminUser(request, set)
        if (!user) return { error: set.status === 403 ? 'Forbidden' : 'Unauthorized' }
        const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, params.id))
        if (!ds) return { ok: false, error: 'Not found' }
        try {
            const testUrl = ds.type === 'prometheus'
                ? `${ds.url.replace(/\/$/, '')}/-/healthy`
                : ds.type === 'loki'
                    ? `${ds.url.replace(/\/$/, '')}/ready`
                    : ds.url
            const res = await fetch(testUrl, { signal: AbortSignal.timeout(5000) })
            return { ok: res.ok, status: res.status }
        } catch (e) {
            return { ok: false, error: String(e) }
        }
    })
