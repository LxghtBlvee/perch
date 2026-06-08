import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { instanceSettings } from '../db/schema'
import { requireAdminUser } from '../middleware/auth'

const SETTINGS_ID = 1

async function getOrCreateSettings() {
    const [row] = await db.select().from(instanceSettings).where(eq(instanceSettings.id, SETTINGS_ID)).limit(1)
    if (row) return row
    const [created] = await db.insert(instanceSettings).values({ id: SETTINGS_ID }).returning()
    return created
}

export const instanceSettingsRoutes = new Elysia({ prefix: '/api/admin/instance-settings' })

    .get('/', async ({ request, set }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }
        return getOrCreateSettings();
    })

    .put('/', async ({ request, set, body }) => {
        const admin = await requireAdminUser(request, set);
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const [updated] = await db
            .insert(instanceSettings)
            .values({ id: SETTINGS_ID, ...body, updatedAt: new Date() })
            .onConflictDoUpdate({
                target: instanceSettings.id,
                set: { ...body, updatedAt: new Date() },
            })
            .returning()

        return updated
    }, {
        body: t.Object({
            sessionDays: t.Optional(t.Number()),
            selfRegistrationEnabled: t.Optional(t.Boolean()),
            defaultUserRole: t.Optional(t.Union([t.Literal('member'), t.Literal('admin')])),
            loginLockoutEnabled: t.Optional(t.Boolean()),
            loginLockoutThreshold: t.Optional(t.Number()),
            agentReportInterval: t.Optional(t.Number()),
            agentReconnectDelay: t.Optional(t.Number()),
            defaultHealthCheckInterval: t.Optional(t.Number()),
            defaultHealthCheckTimeout: t.Optional(t.Number()),
            alertWebhookTimeout: t.Optional(t.Number()),
            defaultAlertCooldown: t.Optional(t.Number()),
            geolocationEnabled: t.Optional(t.Boolean()),
            metricsRetentionDays: t.Optional(t.Number()),
            alertHistoryRetentionDays: t.Optional(t.Number()),
            healthCheckResultsRetentionDays: t.Optional(t.Number()),
            maintenanceModeEnabled: t.Optional(t.Boolean()),
            statusPageEnabled: t.Optional(t.Boolean()),
        })
    })