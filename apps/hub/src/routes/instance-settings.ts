import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { instanceSettings } from '../db/schema'
import { requireAdminUser } from '../middleware/auth'
import { agentRegistry } from '../services/agent-registry'

const SETTINGS_ID = 1

// ── Version cache ────────────────────────────────────────────────────────────
let versionCache: { tag: string; fetchedAt: number } | null = null
const VERSION_CACHE_TTL = 60 * 60 * 1000 // 1 hour

async function resolveVersion(): Promise<string> {
    // Explicit env var wins (e.g. set in docker-compose as PERCH_VERSION)
    if (process.env.PERCH_VERSION) return process.env.PERCH_VERSION

    // Return cached value if still fresh
    if (versionCache && Date.now() - versionCache.fetchedAt < VERSION_CACHE_TTL) {
        return versionCache.tag
    }

    try {
        const res = await fetch(
            'https://hub.docker.com/v2/repositories/lxghtblvee/perch-hub/tags?page_size=20&ordering=last_updated',
        )
        if (!res.ok) throw new Error('Docker Hub error')
        const data = await res.json() as { results: Array<{ name: string }> }
        // First non-"latest" tag is the most recently pushed version tag
        const tag = data.results.find(t => t.name !== 'latest')?.name ?? 'unknown'
        versionCache = { tag, fetchedAt: Date.now() }
        return tag
    } catch {
        return 'unknown'
    }
}

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
            enabledPlatforms: t.Optional(t.String()),
            onboardingCompleted: t.Optional(t.Boolean()),
        })
    })