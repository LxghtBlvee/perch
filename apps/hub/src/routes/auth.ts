import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users, oauthProviders } from '../db/schema'
import {
    createSession,
    deleteSession,
    verifyPassword,
    findOrCreateOAuthUser,
    validateSession,
} from '../services/auth'

// In-memory OAuth state store (CSRF protection)
const oauthStateStore = new Map<string, { provider: string; expiresAt: number }>()

function generateState(): string {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getCallbackBase(request: Request): string {
    const proto = request.headers.get('x-forwarded-proto') ?? 'http'
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:8484'
    return `${proto}://${host}`
}

export const authRoutes = new Elysia({ prefix: '/api/auth' })
    // Email/password login
    .post('/login', async ({ body, error }) => {
        const { email, password } = body
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
        if (!user || !user.passwordHash) return error(401, { error: 'Invalid credentials' })

        const ok = await verifyPassword(password, user.passwordHash)
        if (!ok) return error(401, { error: 'Invalid credentials' })

        const token = await createSession(user.id)
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                role: user.role,
            },
        }
    }, {
        body: t.Object({ email: t.String(), password: t.String() }),
    })

    // Logout
    .post('/logout', async ({ request }) => {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
        if (token) await deleteSession(token)
        return { ok: true }
    })

    // Current user
    .get('/me', async ({ request, set }) => {
        const token = request.headers.get('authorization')?.slice(7) ?? null
        const user = token ? await validateSession(token) : null
        if (!user) { set.status = 401; return { error: 'Unauthorized' } }
        return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role }
    })

    // Initiate OAuth flow
    .get('/:provider', async ({ params, request, error, redirect }) => {
        const { provider } = params
        if (!['github', 'google', 'custom'].includes(provider)) {
            return error(400, { error: 'Unknown provider' })
        }

        const [providerRow] = await db
            .select()
            .from(oauthProviders)
            .where(eq(oauthProviders.provider, provider as 'github' | 'google' | 'custom'))
            .limit(1)

        if (!providerRow?.enabled || !providerRow.clientId) {
            return error(400, { error: 'Provider not configured' })
        }

        const state = generateState()
        oauthStateStore.set(state, { provider, expiresAt: Date.now() + 10 * 60 * 1000 })

        // Clean up expired states
        for (const [k, v] of oauthStateStore) {
            if (v.expiresAt < Date.now()) oauthStateStore.delete(k)
        }

        const callbackUrl = `${getCallbackBase(request)}/api/auth/${provider}/callback`

        if (provider === 'github') {
            const params = new URLSearchParams({
                client_id: providerRow.clientId,
                redirect_uri: callbackUrl,
                scope: 'user:email',
                state,
            })
            return redirect(`https://github.com/login/oauth/authorize?${params}`)
        }

        if (provider === 'google') {
            const params = new URLSearchParams({
                client_id: providerRow.clientId,
                redirect_uri: callbackUrl,
                response_type: 'code',
                scope: 'openid email profile',
                state,
                access_type: 'online',
            })
            return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
        }

        // Custom provider
        if (!providerRow.customAuthorizationUrl) {
            return error(400, { error: 'Custom provider authorization URL not configured' })
        }
        const customParams = new URLSearchParams({
            client_id: providerRow.clientId,
            redirect_uri: callbackUrl,
            response_type: 'code',
            scope: providerRow.customScopes ?? 'openid email profile',
            state,
        })
        return redirect(`${providerRow.customAuthorizationUrl}?${customParams}`)
    }, {
        params: t.Object({ provider: t.String() }),
    })

    // OAuth callback
    .get('/:provider/callback', async ({ params, query, request, error, redirect }) => {
        const { provider } = params
        const { code, state } = query

        if (!code || !state) return error(400, { error: 'Missing code or state' })

        const storedState = oauthStateStore.get(state)
        if (!storedState || storedState.provider !== provider || storedState.expiresAt < Date.now()) {
            return error(400, { error: 'Invalid or expired state' })
        }
        oauthStateStore.delete(state)

        const [providerRow] = await db
            .select()
            .from(oauthProviders)
            .where(eq(oauthProviders.provider, provider as 'github' | 'google' | 'custom'))
            .limit(1)

        if (!providerRow?.enabled || !providerRow.clientId || !providerRow.clientSecret) {
            return error(400, { error: 'Provider not configured' })
        }

        const callbackUrl = `${getCallbackBase(request)}/api/auth/${provider}/callback`

        try {
            let userInfo: { id: string; email: string; name?: string; avatar?: string }

            if (provider === 'github') {
                const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
                    method: 'POST',
                    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client_id: providerRow.clientId,
                        client_secret: providerRow.clientSecret,
                        code,
                        redirect_uri: callbackUrl,
                    }),
                })
                const tokenData = await tokenRes.json() as { access_token?: string }
                if (!tokenData.access_token) return error(400, { error: 'Failed to exchange code' })

                const [profile, emails] = await Promise.all([
                    fetch('https://api.github.com/user', {
                        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
                    }).then(r => r.json()) as Promise<{ id: number; name?: string; avatar_url?: string; email?: string }>,
                    fetch('https://api.github.com/user/emails', {
                        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
                    }).then(r => r.json()) as Promise<{ email: string; primary: boolean; verified: boolean }[]>,
                ])

                const primaryEmail = emails.find(e => e.primary && e.verified)?.email ?? profile.email
                if (!primaryEmail) return error(400, { error: 'No verified email on GitHub account' })

                userInfo = { id: String(profile.id), email: primaryEmail, name: profile.name, avatar: profile.avatar_url }

            } else if (provider === 'google') {
                const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code,
                        client_id: providerRow.clientId,
                        client_secret: providerRow.clientSecret,
                        redirect_uri: callbackUrl,
                        grant_type: 'authorization_code',
                    }),
                })
                const tokenData = await tokenRes.json() as { access_token?: string }
                if (!tokenData.access_token) return error(400, { error: 'Failed to exchange code' })

                const profile = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                }).then(r => r.json()) as { id: string; email: string; name?: string; picture?: string }

                userInfo = { id: profile.id, email: profile.email, name: profile.name, avatar: profile.picture }

            } else {
                // Custom provider
                if (!providerRow.customTokenUrl || !providerRow.customUserinfoUrl) {
                    return error(400, { error: 'Custom provider not fully configured' })
                }
                const tokenRes = await fetch(providerRow.customTokenUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
                    body: new URLSearchParams({
                        code,
                        client_id: providerRow.clientId,
                        client_secret: providerRow.clientSecret,
                        redirect_uri: callbackUrl,
                        grant_type: 'authorization_code',
                    }),
                })
                const tokenData = await tokenRes.json() as { access_token?: string }
                if (!tokenData.access_token) return error(400, { error: 'Failed to exchange code' })

                const profile = await fetch(providerRow.customUserinfoUrl, {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                }).then(r => r.json()) as { sub?: string; id?: string; email: string; name?: string; picture?: string; avatar_url?: string }

                userInfo = {
                    id: profile.sub ?? profile.id ?? profile.email,
                    email: profile.email,
                    name: profile.name,
                    avatar: profile.picture ?? profile.avatar_url,
                }
            }

            const user = await findOrCreateOAuthUser({
                provider,
                providerUserId: userInfo.id,
                email: userInfo.email,
                name: userInfo.name,
                avatarUrl: userInfo.avatar,
            })

            const token = await createSession(user.id)
            // Redirect to frontend with token in query param — frontend picks it up and stores it
            return redirect(`/?token=${token}`)

        } catch (err) {
            console.error('[oauth callback]', err)
            return error(500, { error: 'OAuth failed' })
        }
    }, {
        params: t.Object({ provider: t.String() }),
        query: t.Object({
            code: t.Optional(t.String()),
            state: t.Optional(t.String()),
            error: t.Optional(t.String()),
        }),
    })