import Elysia, { t } from 'elysia'
import { eq, and, ne, desc, inArray, isNull, or } from 'drizzle-orm'
import { db } from '../db'
import { statusPages, statusPageChecks, statusPageIncidents, healthChecks, healthCheckResults } from '../db/schema'
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
            description: t.Optional(t.Nullable(t.String())),
            logoUrl: t.Optional(t.Nullable(t.String())),
            customDomain: t.Optional(t.Nullable(t.String())),
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

    // --- Incidents ---

    .get('/api/admin/status-pages/:id/incidents', async ({ request, set, params, error }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const [page] = await db.select({ id: statusPages.id }).from(statusPages).where(eq(statusPages.id, params.id)).limit(1)
        if (!page) return error(404, { error: 'Not found' })

        const incidents = await db
            .select()
            .from(statusPageIncidents)
            .where(eq(statusPageIncidents.statusPageId, params.id))
            .orderBy(desc(statusPageIncidents.createdAt))

        return incidents
    }, { params: t.Object({ id: t.String() }) })

    .post('/api/admin/status-pages/:id/incidents', async ({ request, set, params, body, error }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const [page] = await db.select({ id: statusPages.id }).from(statusPages).where(eq(statusPages.id, params.id)).limit(1)
        if (!page) return error(404, { error: 'Not found' })

        const defaultStatus = body.type === 'maintenance' ? 'scheduled' as const : 'investigating' as const

        const [incident] = await db.insert(statusPageIncidents).values({
            statusPageId: params.id,
            type: body.type ?? 'incident',
            title: body.title,
            body: body.body ?? '',
            status: body.status ?? defaultStatus,
            scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        }).returning()

        return incident
    }, {
        params: t.Object({ id: t.String() }),
        body: t.Object({
            title: t.String(),
            type: t.Optional(t.Union([t.Literal('incident'), t.Literal('maintenance')])),
            body: t.Optional(t.String()),
            status: t.Optional(t.Union([
                t.Literal('investigating'), t.Literal('identified'),
                t.Literal('monitoring'), t.Literal('resolved'),
                t.Literal('scheduled'), t.Literal('in_progress'), t.Literal('completed'),
            ])),
            scheduledAt: t.Optional(t.Nullable(t.String())),
        })
    })

    .patch('/api/admin/status-pages/:id/incidents/:incidentId', async ({ request, set, params, body, error }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const resolvedStatuses = ['resolved', 'completed']
        const resolvedAt = body.status && resolvedStatuses.includes(body.status) ? new Date() : undefined

        const [updated] = await db
            .update(statusPageIncidents)
            .set({
                ...(body.title !== undefined && { title: body.title }),
                ...(body.body !== undefined && { body: body.body }),
                ...(body.status !== undefined && { status: body.status }),
                ...(body.scheduledAt !== undefined && { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null }),
                ...(resolvedAt && { resolvedAt }),
                updatedAt: new Date(),
            })
            .where(and(
                eq(statusPageIncidents.id, params.incidentId),
                eq(statusPageIncidents.statusPageId, params.id),
            ))
            .returning()

        if (!updated) return error(404, { error: 'Not found' })
        return updated
    }, {
        params: t.Object({ id: t.String(), incidentId: t.String() }),
        body: t.Object({
            title: t.Optional(t.String()),
            body: t.Optional(t.String()),
            status: t.Optional(t.Union([
                t.Literal('investigating'), t.Literal('identified'),
                t.Literal('monitoring'), t.Literal('resolved'),
                t.Literal('scheduled'), t.Literal('in_progress'), t.Literal('completed'),
            ])),
            scheduledAt: t.Optional(t.Nullable(t.String())),
        })
    })

    .delete('/api/admin/status-pages/:id/incidents/:incidentId', async ({ request, set, params, error }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const [deleted] = await db
            .delete(statusPageIncidents)
            .where(and(
                eq(statusPageIncidents.id, params.incidentId),
                eq(statusPageIncidents.statusPageId, params.id),
            ))
            .returning()

        if (!deleted) return error(404, { error: 'Not found' })
        return { ok: true }
    }, { params: t.Object({ id: t.String(), incidentId: t.String() }) })

    // --- Public status page ---

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

        // Fetch active incidents (unresolved) for public display
        const incidents = await db
            .select()
            .from(statusPageIncidents)
            .where(and(
                eq(statusPageIncidents.statusPageId, page.id),
                or(isNull(statusPageIncidents.resolvedAt), eq(statusPageIncidents.status, 'investigating')),
            ))
            .orderBy(desc(statusPageIncidents.createdAt))

        const activeIncidents = incidents.filter(i =>
            i.status !== 'resolved' && i.status !== 'completed'
        ).map(i => ({
            id: i.id,
            type: i.type,
            title: i.title,
            body: i.body,
            status: i.status,
            scheduledAt: i.scheduledAt?.toISOString() ?? null,
            createdAt: i.createdAt.toISOString(),
            updatedAt: i.updatedAt.toISOString(),
        }))

        if (checks.length === 0) {
            return { id: page.id, name: page.name, slug: page.slug, description: page.description, logoUrl: page.logoUrl, checks: [], incidents: activeIncidents }
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

        return { id: page.id, name: page.name, slug: page.slug, description: page.description, logoUrl: page.logoUrl, checks: enrichedChecks, incidents: activeIncidents }
    }, { params: t.Object({ slug: t.String() }) })