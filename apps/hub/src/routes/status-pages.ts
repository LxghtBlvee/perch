import Elysia, { t } from 'elysia'
import { eq, and, ne, desc, inArray } from 'drizzle-orm'
import { db } from '../db'
import { statusPages, statusPageChecks, healthChecks, healthCheckResults } from '../db/schema'
import { requireAdminUser, getAuthUser } from '../middleware/auth'

export const statusPageRoutes = new Elysia()

    .get('/api/admin/status-pages', async ({ request, set }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const pages = await db.select().from(statusPages).orderBy(statusPages.createdAt)
        const allChecks = await db.select({ statusPageId: statusPageChecks.statusPageId }).from(statusPageChecks)

        return pages.map(p => ({
            ...p,
            checkCount: allChecks.filter(c => c.statusPageId === p.id).length,
        }))
    })

    .post('/api/admin/status-pages', async ({ request, set, body, error }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const [existing] = await db.select().from(statusPages).where(eq(statusPages.slug, body.slug)).limit(1)
        if (existing) return error(409, { error: 'Slug already in use' })

        const [page] = await db.insert(statusPages).values({
            slug: body.slug,
            name: body.name,
            isPublic: body.isPublic ?? true,
        }).returning()

        return page
    }, {
        body: t.Object({
            name: t.String(),
            slug: t.String(),
            isPublic: t.Optional(t.Boolean()),
        })
    })

    .get('/api/admin/status-pages/:id', async ({ request, set, params, error }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const [page] = await db.select().from(statusPages).where(eq(statusPages.id, params.id)).limit(1)
        if (!page) return error(404, { error: 'Not found' })

        const checks = await db
            .select({
                id: statusPageChecks.id,
                healthCheckId: statusPageChecks.healthCheckId,
                displayName: statusPageChecks.displayName,
                displayMode: statusPageChecks.displayMode,
                showUrl: statusPageChecks.showUrl,
                sortOrder: statusPageChecks.sortOrder,
                checkName: healthChecks.name,
                checkUrl: healthChecks.url,
            })
            .from(statusPageChecks)
            .innerJoin(healthChecks, eq(statusPageChecks.healthCheckId, healthChecks.id))
            .where(eq(statusPageChecks.statusPageId, params.id))
            .orderBy(statusPageChecks.sortOrder)

        return { ...page, checks }
    }, { params: t.Object({ id: t.String() }) })

    .put('/api/admin/status-pages/:id', async ({ request, set, params, body, error }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        if (body.slug) {
            const [conflict] = await db.select({ id: statusPages.id })
                .from(statusPages)
                .where(and(eq(statusPages.slug, body.slug), ne(statusPages.id, params.id)))
                .limit(1)
            if (conflict) return error(409, { error: 'Slug already in use' })
        }

        const [updated] = await db
            .update(statusPages)
            .set({ ...body, updatedAt: new Date() })
            .where(eq(statusPages.id, params.id))
            .returning()

        if (!updated) return error(404, { error: 'Not found' })
        return updated
    }, {
        params: t.Object({ id: t.String() }),
        body: t.Object({
            name: t.Optional(t.String()),
            slug: t.Optional(t.String()),
            isPublic: t.Optional(t.Boolean()),
        })
    })

    .delete('/api/admin/status-pages/:id', async ({ request, set, params, error }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const [deleted] = await db.delete(statusPages).where(eq(statusPages.id, params.id)).returning()
        if (!deleted) return error(404, { error: 'Not found' })
        return { ok: true }
    }, { params: t.Object({ id: t.String() }) })

    .put('/api/admin/status-pages/:id/checks', async ({ request, set, params, body, error }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const [page] = await db.select().from(statusPages).where(eq(statusPages.id, params.id)).limit(1)
        if (!page) return error(404, { error: 'Not found' })

        await db.delete(statusPageChecks).where(eq(statusPageChecks.statusPageId, params.id))

        if (body.checks.length > 0) {
            await db.insert(statusPageChecks).values(
                body.checks.map((c, i) => ({
                    statusPageId: params.id,
                    healthCheckId: c.healthCheckId,
                    displayName: c.displayName ?? null,
                    displayMode: c.displayMode ?? 'full_history' as const,
                    showUrl: c.showUrl ?? false,
                    sortOrder: i,
                }))
            )
        }

        return { ok: true }
    }, {
        params: t.Object({ id: t.String() }),
        body: t.Object({
            checks: t.Array(t.Object({
                healthCheckId: t.String(),
                displayName: t.Optional(t.String()),
                displayMode: t.Optional(t.Union([
                    t.Literal('full_history'),
                    t.Literal('response_time'),
                    t.Literal('current_status'),
                ])),
                showUrl: t.Optional(t.Boolean()),
            }))
        })
    })

    .get('/api/status/:slug', async ({ request, set, params, error }) => {
        const [page] = await db.select().from(statusPages).where(eq(statusPages.slug, params.slug)).limit(1)
        if (!page) return error(404, { error: 'Not found' })

        if (!page.isPublic) {
            const user = await getAuthUser(request)
            if (!user) { set.status = 401; return { error: 'This status page requires sign-in' } }
        }

        const checks = await db
            .select({
                id: statusPageChecks.id,
                healthCheckId: statusPageChecks.healthCheckId,
                displayName: statusPageChecks.displayName,
                displayMode: statusPageChecks.displayMode,
                showUrl: statusPageChecks.showUrl,
                sortOrder: statusPageChecks.sortOrder,
                checkName: healthChecks.name,
                checkUrl: healthChecks.url,
            })
            .from(statusPageChecks)
            .innerJoin(healthChecks, eq(statusPageChecks.healthCheckId, healthChecks.id))
            .where(eq(statusPageChecks.statusPageId, page.id))
            .orderBy(statusPageChecks.sortOrder)

        if (checks.length === 0) {
            return { id: page.id, name: page.name, slug: page.slug, checks: [] }
        }

        const checkIds = checks.map(c => c.healthCheckId)

        const allResults = await db
            .select()
            .from(healthCheckResults)
            .where(inArray(healthCheckResults.healthCheckId, checkIds))
            .orderBy(desc(healthCheckResults.checkedAt))
            .limit(checkIds.length * 100)

        const resultsByCheck = new Map<string, typeof allResults>()
        for (const r of allResults) {
            if (!resultsByCheck.has(r.healthCheckId)) resultsByCheck.set(r.healthCheckId, [])
            resultsByCheck.get(r.healthCheckId)!.push(r)
        }

        const enrichedChecks = checks.map(c => {
            const results = resultsByCheck.get(c.healthCheckId) ?? []
            const current = results[0]
                ? { status: results[0].status, latency: results[0].latency, checkedAt: results[0].checkedAt.toISOString() }
                : null

            let history: Array<{ status: string; latency: number | null; checkedAt: string }> = []
            const historyLimit = c.displayMode === 'full_history' ? 90 : c.displayMode === 'response_time' ? 50 : 0
            if (historyLimit > 0) {
                history = results.slice(0, historyLimit).map(r => ({
                    status: r.status,
                    latency: r.latency,
                    checkedAt: r.checkedAt.toISOString(),
                }))
            }

            return {
                id: c.id,
                displayName: c.displayName ?? c.checkName,
                displayMode: c.displayMode,
                url: c.showUrl ? c.checkUrl : null,
                current,
                history,
            }
        })

        return { id: page.id, name: page.name, slug: page.slug, checks: enrichedChecks }
    }, { params: t.Object({ slug: t.String() }) })