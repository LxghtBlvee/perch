import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { oauthProviders } from '../db/schema'
import { requireAdminUser } from '../middleware/auth'

const PROVIDERS = ['github', 'google', 'custom'] as const
type ProviderType = typeof PROVIDERS[number]

export const oauthSettingsRoutes = new Elysia({ prefix: '/api/settings/oauth' })

    // List all provider configs (secrets redacted)
    .get('/', async ({ request, set }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const rows = await db.select().from(oauthProviders)

        return PROVIDERS.map(provider => {
            const row = rows.find(r => r.provider === provider)
            return {
                provider,
                enabled: row?.enabled ?? false,
                clientId: row?.clientId ?? null,
                hasClientSecret: !!row?.clientSecret,
                customName: row?.customName ?? null,
                customAuthorizationUrl: row?.customAuthorizationUrl ?? null,
                customTokenUrl: row?.customTokenUrl ?? null,
                customUserinfoUrl: row?.customUserinfoUrl ?? null,
                customScopes: row?.customScopes ?? null,
                allowedOrg: row?.allowedOrg ?? null,
                allowedDomain: row?.allowedDomain ?? null,
            }
        })
    })

    // Upsert a provider config
    .put('/:provider', async ({ request, set, params, body, error }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const provider = params.provider as ProviderType
        if (!PROVIDERS.includes(provider)) return error(400, { error: 'Unknown provider' })

        const [existing] = await db
            .select()
            .from(oauthProviders)
            .where(eq(oauthProviders.provider, provider))
            .limit(1)

        const values = {
            provider,
            enabled: body.enabled,
            clientId: body.clientId ?? null,
            // Only update secret if provided (empty string = clear it)
            ...(body.clientSecret !== undefined
                ? { clientSecret: body.clientSecret || null }
                : {}),
            customName: body.customName ?? null,
            customAuthorizationUrl: body.customAuthorizationUrl ?? null,
            customTokenUrl: body.customTokenUrl ?? null,
            customUserinfoUrl: body.customUserinfoUrl ?? null,
            customScopes: body.customScopes ?? null,
            allowedOrg: body.allowedOrg ?? null,
            allowedDomain: body.allowedDomain ?? null,
            updatedAt: new Date(),
        }

        if (existing) {
            await db.update(oauthProviders).set(values).where(eq(oauthProviders.provider, provider))
        } else {
            await db.insert(oauthProviders).values(values)
        }

        return { ok: true }
    }, {
        params: t.Object({ provider: t.String() }),
        body: t.Object({
            enabled: t.Boolean(),
            clientId: t.Optional(t.String()),
            clientSecret: t.Optional(t.String()),
            customName: t.Optional(t.String()),
            customAuthorizationUrl: t.Optional(t.String()),
            customTokenUrl: t.Optional(t.String()),
            customUserinfoUrl: t.Optional(t.String()),
            customScopes: t.Optional(t.String()),
            allowedOrg: t.Optional(t.String()),
            allowedDomain: t.Optional(t.String()),
        }),
    })