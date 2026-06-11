import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { dataSources } from '../db/schema'
import { requireAuthUser } from '../middleware/auth'

const PRIVATE_IP_PATTERNS = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\.0\.0\.0/,
    /^::1$/,
    /^\[::1\]$/,
    /^fc[0-9a-f]{2}:/i,
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
        const user = await requireAuthUser(request, set)
        if (!user) return { error: 'Unauthorized' }
        if (!isSafeUrl(body.url)) { set.status = 400; return { error: 'URL must be a publicly accessible http/https address' } }
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
        const user = await requireAuthUser(request, set)
        if (!user) return { error: 'Unauthorized' }
        if (body.url !== undefined && !isSafeUrl(body.url)) { set.status = 400; return { error: 'URL must be a publicly accessible http/https address' } }
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
        const user = await requireAuthUser(request, set)
        if (!user) return { error: 'Unauthorized' }
        await db.delete(dataSources).where(eq(dataSources.id, params.id))
        return { success: true }
    })

    // Proxy: test connectivity to a data source
    .post('/:id/test', async ({ params, request, set }) => {
        const user = await requireAuthUser(request, set)
        if (!user) return { error: 'Unauthorized' }
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
