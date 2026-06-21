import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { instanceSettings } from '../db/schema'
import { requireAdminUser, requireAuthUser } from '../middleware/auth'
import { agentRegistry } from '../services/agent-registry'
import { healthChecker } from '../services/health-checker'
import { resolveVersion } from '../lib/version'

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

    .get('/onboarding', async ({ request, set }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const settings = await getOrCreateSettings()

        // Detect platforms from connected agents — any connected agent implies Docker
        const detectedPlatforms: string[] = []
        if (agentRegistry.getAll().length > 0) detectedPlatforms.push('docker')

        return {
            completed: settings.onboardingCompleted,
            enabledPlatforms: JSON.parse(settings.enabledPlatforms) as string[],
            detectedPlatforms,
        }
    })

    .post('/onboarding/complete', async ({ request, set, body }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const platforms = JSON.stringify(body.platforms)
        const [updated] = await db
            .insert(instanceSettings)
            .values({ id: SETTINGS_ID, enabledPlatforms: platforms, onboardingCompleted: true, updatedAt: new Date() })
            .onConflictDoUpdate({
                target: instanceSettings.id,
                set: { enabledPlatforms: platforms, onboardingCompleted: true, updatedAt: new Date() },
            })
            .returning()

        return { completed: updated.onboardingCompleted, enabledPlatforms: JSON.parse(updated.enabledPlatforms) as string[] }
    }, {
        body: t.Object({
            platforms: t.Array(t.String()),
        })
    })

    .get('/version', async ({ request, set }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }
        const version = await resolveVersion()
        return { version }
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

        // Apply changes that other subsystems cache or run on their own loop.
        healthChecker.invalidateTimeoutCache()
        agentRegistry.broadcast({
            type: 'config_update',
            reportInterval: updated.agentReportInterval,
            reconnectDelay: updated.agentReconnectDelay,
        })

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
            logDefaultTail: t.Optional(t.Number()),
            logDefaultWrap: t.Optional(t.Boolean()),
            logShowTimestamps: t.Optional(t.Boolean()),
            logTagUntagged: t.Optional(t.Boolean()),
            enabledPlatforms: t.Optional(t.String()),
            onboardingCompleted: t.Optional(t.Boolean()),
        })
    })

// Log display defaults readable by any authenticated user (the LogViewer is used
// by members, who can't reach the admin-only settings endpoint above).
export const clientSettingsRoutes = new Elysia({ prefix: '/api/instance-settings' })
    .get('/client', async ({ request, set }) => {
        const user = await requireAuthUser(request, set)
        if (!user) return { error: 'Unauthorized' }
        const settings = await getOrCreateSettings()
        return {
            logDefaultTail: settings.logDefaultTail,
            logDefaultWrap: settings.logDefaultWrap,
            logShowTimestamps: settings.logShowTimestamps,
            logTagUntagged: settings.logTagUntagged,
        }
    })