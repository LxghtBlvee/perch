import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users, oauthProviders, instanceSettings } from '../db/schema'
import { env } from '../config/env.validation'
import {
    createSession,
    deleteSession,
    verifyPassword,
    hashPassword,
    findOrCreateOAuthUser,
    validateSession,
    useRecoveryToken,
    generateHandoff,
    exchangeHandoff,
    OAuthLinkError,
} from '../services/auth'
import { requireAuthUser } from '../middleware/auth'

// In-memory OAuth state store (CSRF protection). Each entry also holds the PKCE
// code_verifier and a per-flow browser nonce that must come back as a cookie.
const oauthStateStore = new Map<string, { provider: string; expiresAt: number; codeVerifier: string; browserNonce: string }>()
const OAUTH_COOKIE = 'perch_oauth'

// In-memory login failure tracker. The account lock is keyed by (email + client IP)
// so a remote attacker cannot lock a victim out of their own account by spamming
// failures from elsewhere (account-lockout DoS); a separate per-IP counter throttles
// an IP that sprays many accounts.
const accountFailures = new Map<string, { count: number; resetAt: number }>()
const ipFailures = new Map<string, { count: number; resetAt: number }>()
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_FALLBACK_MAX_ATTEMPTS = 10
const IP_ATTEMPT_MULTIPLIER = 5 // an IP may fail this many × the per-account limit before being throttled outright

/** Best-effort client IP from proxy headers (Cloudflare / reverse proxy). */
function getClientIp(request: Request): string {
    return request.headers.get('cf-connecting-ip')
        ?? request.headers.get('x-real-ip')
        ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? 'unknown'
}

function bumpCount(map: Map<string, { count: number; resetAt: number }>, key: string): void {
    const now = Date.now()
    const entry = map.get(key)
    if (!entry || entry.resetAt < now) map.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
    else entry.count++
}

function retryAfterFor(map: Map<string, { count: number; resetAt: number }>, key: string, maxAttempts: number): number {
    const now = Date.now()
    const entry = map.get(key)
    if (!entry || entry.resetAt < now) return 0
    return entry.count >= maxAttempts ? entry.resetAt - now : 0
}

/** Check if this email+IP (or the IP overall) is currently blocked — does NOT mutate state */
function isLoginBlocked(email: string, ip: string, maxAttempts: number): { blocked: boolean; retryAfterMs: number } {
    const acct = retryAfterFor(accountFailures, `${email.toLowerCase()}|${ip}`, maxAttempts)
    const perIp = retryAfterFor(ipFailures, ip, maxAttempts * IP_ATTEMPT_MULTIPLIER)
    const retryAfterMs = Math.max(acct, perIp)
    return { blocked: retryAfterMs > 0, retryAfterMs }
}

/** Record a failed login attempt — only called on actual failures */
function recordLoginFailure(email: string, ip: string): void {
    bumpCount(accountFailures, `${email.toLowerCase()}|${ip}`)
    bumpCount(ipFailures, ip)
}

function generateState(): string {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** PKCE: random high-entropy verifier (RFC 7636). */
function generateCodeVerifier(): string {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Buffer.from(bytes).toString('base64url')
}

/** PKCE: S256 challenge derived from the verifier. */
async function deriveCodeChallenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
    return Buffer.from(new Uint8Array(digest)).toString('base64url')
}

/** Builds the transient OAuth nonce cookie (HttpOnly, Lax, ~10 min). */
function buildOauthCookie(value: string, secure: boolean, maxAgeSeconds: number): string {
    const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`]
    if (secure) attrs.push('Secure')
    return `${OAUTH_COOKIE}=${value}; ${attrs.join('; ')}`
}

function readCookie(request: Request, name: string): string | null {
    const header = request.headers.get('cookie')
    if (!header) return null
    for (const part of header.split(';')) {
        const eq = part.indexOf('=')
        if (eq === -1) continue
        if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
    }
    return null
}

function getCallbackBase(request: Request): string {
    // PERCH_BASE_URL is the safe, explicit override — always use it if set
    if (env.baseUrl) return env.baseUrl.replace(/\/$/, '')
    const proto = request.headers.get('x-forwarded-proto') ?? 'http'
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:8484'
    return `${proto}://${host}`
}

function getOidcUrls(providerRow: typeof oauthProviders.$inferSelect): { authUrl: string; tokenUrl: string; userinfoUrl: string; scope: string } | null {
    switch (providerRow.provider) {
        case 'google':
            return { authUrl: 'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl: 'https://oauth2.googleapis.com/token', userinfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo', scope: 'openid email profile' }
        case 'microsoft': {
            const tenant = providerRow.providerTenantId ?? 'common'
            return { authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`, tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, userinfoUrl: 'https://graph.microsoft.com/oidc/userinfo', scope: 'openid email profile' }
        }
        case 'gitlab': {
            const base = providerRow.providerBaseUrl ?? 'https://gitlab.com'
            return { authUrl: `${base}/oauth/authorize`, tokenUrl: `${base}/oauth/token`, userinfoUrl: `${base}/oauth/userinfo`, scope: 'openid email profile' }
        }
        case 'okta': {
            if (!providerRow.providerBaseUrl) return null
            return { authUrl: `https://${providerRow.providerBaseUrl}/oauth2/default/v1/authorize`, tokenUrl: `https://${providerRow.providerBaseUrl}/oauth2/default/v1/token`, userinfoUrl: `https://${providerRow.providerBaseUrl}/oauth2/default/v1/userinfo`, scope: 'openid email profile' }
        }
        case 'custom':
            if (!providerRow.customAuthorizationUrl || !providerRow.customTokenUrl || !providerRow.customUserinfoUrl) return null
            return { authUrl: providerRow.customAuthorizationUrl, tokenUrl: providerRow.customTokenUrl, userinfoUrl: providerRow.customUserinfoUrl, scope: providerRow.customScopes ?? 'openid email profile' }
        default:
            return null
    }
}

export const authRoutes = new Elysia({ prefix: '/api/auth' })
    // Public: enabled OAuth providers (for login page, no auth required)
    .get('/providers', async () => {
        const rows = await db
            .select({ provider: oauthProviders.provider, customName: oauthProviders.customName })
            .from(oauthProviders)
            .where(eq(oauthProviders.enabled, true))
        return rows
    })

    // Recovery token login (one-time link generated by admin)
    .get('/recover', async ({ query, set, redirect }) => {
        const { token } = query
        if (!token) { set.status = 400; return { error: 'Missing token' } }
        const sessionToken = await useRecoveryToken(token)
        if (!sessionToken) { set.status = 400; return { error: 'Invalid or expired recovery link' } }
        const code = await generateHandoff(sessionToken)
        return redirect(`/?code=${code}`)
    }, {
        query: t.Object({ token: t.Optional(t.String()) }),
    })

    // Exchange a short-lived handoff code for a session token.
    // The frontend calls this after being redirected from OAuth/recovery with ?code=
    .post('/exchange', async ({ body, set }) => {
        const token = await exchangeHandoff(body.code)
        if (!token) { set.status = 400; return { error: 'Invalid or expired code' } }
        return { token }
    }, {
        body: t.Object({ code: t.String() }),
    })

    // Email/password login
    .post('/login', async ({ body, request, set }) => {
        const { email, password } = body
        const ip = getClientIp(request)

        // Read instance settings once — covers lockout config + maintenance mode
        const [settings] = await db.select({
            maintenanceModeEnabled: instanceSettings.maintenanceModeEnabled,
            loginLockoutEnabled: instanceSettings.loginLockoutEnabled,
            loginLockoutThreshold: instanceSettings.loginLockoutThreshold,
        }).from(instanceSettings).where(eq(instanceSettings.id, 1)).limit(1)

        const lockoutEnabled = settings?.loginLockoutEnabled !== false
        const maxAttempts = lockoutEnabled
            ? (settings?.loginLockoutThreshold ?? LOGIN_FALLBACK_MAX_ATTEMPTS)
            : Infinity

        if (lockoutEnabled) {
            const rateLimit = isLoginBlocked(email, ip, maxAttempts)
            if (rateLimit.blocked) {
                const retryAfterSecs = Math.ceil(rateLimit.retryAfterMs / 1000)
                { set.status = 429; return { error: `Too many login attempts. Try again in ${retryAfterSecs} seconds.` } }
            }
        }

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
        if (!user || !user.passwordHash) {
            recordLoginFailure(email, ip)
            set.status = 401; return { error: 'Invalid credentials' }
        }

        const ok = await verifyPassword(password, user.passwordHash)
        if (!ok) {
            recordLoginFailure(email, ip)
            set.status = 401; return { error: 'Invalid credentials' }
        }

        // Maintenance mode: block non-admin logins
        if (settings?.maintenanceModeEnabled && user.role !== 'admin') {
            set.status = 503; return { error: 'Perch is in maintenance mode. Only admins can sign in.' }
        }

        const token = await createSession(user.id)
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                role: user.role,
                hasPassword: !!user.passwordHash,
                seeded: user.seeded,
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
        return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, hasPassword: !!user.passwordHash, seeded: user.seeded }
    })

    // Update current user profile
    .patch('/me', async ({ request, body, set }) => {
        const user = await requireAuthUser(request, set)
        if (!user) return { error: 'Unauthorized' }

        const updates: Record<string, unknown> = {}

        if (body.name !== undefined) updates.name = body.name || null

        if (body.email && body.email !== user.email) {
            // Email changes require password confirmation to prevent account takeover via stolen session
            if (!body.currentPassword) { set.status = 400; return { error: 'Current password required to change email' } }
            if (!user.passwordHash) { set.status = 400; return { error: 'Cannot change email on an OAuth-only account without a password set' } }
            const emailPasswordOk = await verifyPassword(body.currentPassword, user.passwordHash)
            if (!emailPasswordOk) { set.status = 401; return { error: 'Current password incorrect' } }
            const [existing] = await db.select().from(users).where(eq(users.email, body.email)).limit(1)
            if (existing) { set.status = 409; return { error: 'Email already in use' } }
            updates.email = body.email
        }

        if (body.newPassword) {
            if (user.passwordHash) {
                // Account already has a password — require current password to change it
                if (!body.currentPassword) { set.status = 400; return { error: 'Current password required' } }
                const ok = await verifyPassword(body.currentPassword, user.passwordHash)
                if (!ok) { set.status = 401; return { error: 'Current password incorrect' } }
            }
            // OAuth-only accounts (no passwordHash) can set a password without currentPassword
            updates.passwordHash = await hashPassword(body.newPassword)
        }

        if (Object.keys(updates).length === 0) {
            return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, hasPassword: !!user.passwordHash, seeded: user.seeded }
        }

        updates.updatedAt = new Date()
        const [updated] = await db.update(users).set(updates).where(eq(users.id, user.id)).returning()
        return { id: updated.id, email: updated.email, name: updated.name, avatarUrl: updated.avatarUrl, role: updated.role, hasPassword: !!updated.passwordHash, seeded: updated.seeded }
    }, {
        body: t.Partial(t.Object({
            name: t.String(),
            email: t.String(),
            currentPassword: t.String(),
            newPassword: t.String(),
        })),
    })

    // Initiate OAuth flow
    .get('/:provider', async ({ params, request, set, redirect }) => {
        const { provider } = params
        const KNOWN = ['github', 'google', 'custom', 'microsoft', 'gitlab', 'discord', 'okta']
        if (!KNOWN.includes(provider)) { set.status = 400; return { error: 'Unknown provider' } }

        const [providerRow] = await db.select().from(oauthProviders)
            .where(eq(oauthProviders.provider, provider as typeof oauthProviders.$inferSelect['provider']))
            .limit(1)

        if (!providerRow?.enabled || !providerRow.clientId) { set.status = 400; return { error: 'Provider not configured' } }

        const state = generateState()
        const codeVerifier = generateCodeVerifier()
        const codeChallenge = await deriveCodeChallenge(codeVerifier)
        const browserNonce = generateState()
        oauthStateStore.set(state, { provider, expiresAt: Date.now() + 10 * 60 * 1000, codeVerifier, browserNonce })
        for (const [k, v] of oauthStateStore) { if (v.expiresAt < Date.now()) oauthStateStore.delete(k) }

        const callbackUrl = `${getCallbackBase(request)}/api/auth/${provider}/callback`
        const oidcUrls = getOidcUrls(providerRow)
        // Bind this flow to the browser: the nonce must come back as a cookie on the
        // callback, so a stolen/forged state from another browser can't complete login.
        set.headers['set-cookie'] = buildOauthCookie(browserNonce, callbackUrl.startsWith('https'), 600)
        const pkce = { code_challenge: codeChallenge, code_challenge_method: 'S256' }

        if (provider === 'github') {
            return redirect(`https://github.com/login/oauth/authorize?${new URLSearchParams({ client_id: providerRow.clientId, redirect_uri: callbackUrl, scope: 'user:email', state, ...pkce })}`)
        }

        if (provider === 'discord') {
            return redirect(`https://discord.com/api/oauth2/authorize?${new URLSearchParams({ client_id: providerRow.clientId, redirect_uri: callbackUrl, response_type: 'code', scope: 'identify email', state, ...pkce })}`)
        }

        // All OIDC providers (google, microsoft, gitlab, okta, custom)
        if (!oidcUrls) { set.status = 400; return { error: 'Provider not fully configured' } }
        return redirect(`${oidcUrls.authUrl}?${new URLSearchParams({ client_id: providerRow.clientId, redirect_uri: callbackUrl, response_type: 'code', scope: oidcUrls.scope, state, ...pkce })}`)
    }, {
        params: t.Object({ provider: t.String() }),
    })

    // OAuth callback
    .get('/:provider/callback', async ({ params, query, request, set, redirect }) => {
        const { provider } = params
        const { code, state } = query

        if (!code || !state) { set.status = 400; return { error: 'Missing code or state' } }

        const storedState = oauthStateStore.get(state)
        if (!storedState || storedState.provider !== provider || storedState.expiresAt < Date.now()) {
            set.status = 400; return { error: 'Invalid or expired state' }
        }
        oauthStateStore.delete(state)

        const [providerRow] = await db.select().from(oauthProviders)
            .where(eq(oauthProviders.provider, provider as typeof oauthProviders.$inferSelect['provider']))
            .limit(1)

        if (!providerRow?.enabled || !providerRow.clientId || !providerRow.clientSecret) {
            set.status = 400; return { error: 'Provider not configured' }
        }

        const callbackUrl = `${getCallbackBase(request)}/api/auth/${provider}/callback`
        const base = getCallbackBase(request)

        // Browser binding (anti login-CSRF): the nonce cookie set when this flow
        // started must match the one stored with the state. Always clear the cookie.
        const cookieNonce = readCookie(request, OAUTH_COOKIE)
        set.headers['set-cookie'] = buildOauthCookie('', base.startsWith('https'), 0)
        if (!cookieNonce || cookieNonce !== storedState.browserNonce) {
            return redirect(`${base}/login?error=invalid_state`)
        }

        try {
            let userInfo: { id: string; email: string; name?: string; avatar?: string }

            if (provider === 'github') {
                const tokenData = await fetch('https://github.com/login/oauth/access_token', {
                    method: 'POST',
                    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ client_id: providerRow.clientId, client_secret: providerRow.clientSecret, code, redirect_uri: callbackUrl, code_verifier: storedState.codeVerifier }),
                }).then(r => r.json()) as { access_token?: string }
                if (!tokenData.access_token) { set.status = 400; return { error: 'Failed to exchange code' } }

                const [profile, emails] = await Promise.all([
                    fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' } })
                        .then(r => r.json()) as Promise<{ id: number; login: string; name?: string; avatar_url?: string; email?: string }>,
                    fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' } })
                        .then(r => r.json()) as Promise<{ email: string; primary: boolean; verified: boolean }[]>,
                ])
                const primaryEmail = emails.find(e => e.primary && e.verified)?.email ?? profile.email
                if (!primaryEmail) { set.status = 400; return { error: 'No verified email on GitHub account' } }
                if (providerRow.allowedOrg) {
                    const check = await fetch(`https://api.github.com/orgs/${providerRow.allowedOrg}/members/${profile.login}`, { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' } })
                    if (check.status !== 204) return redirect(`${base}/login?error=org_required&org=${encodeURIComponent(providerRow.allowedOrg)}`)
                }
                userInfo = { id: String(profile.id), email: primaryEmail, name: profile.name, avatar: profile.avatar_url }

            } else if (provider === 'discord') {
                const tokenData = await fetch('https://discord.com/api/oauth2/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ code, client_id: providerRow.clientId, client_secret: providerRow.clientSecret, redirect_uri: callbackUrl, grant_type: 'authorization_code', code_verifier: storedState.codeVerifier }),
                }).then(r => r.json()) as { access_token?: string }
                if (!tokenData.access_token) { set.status = 400; return { error: 'Failed to exchange code' } }

                const profile = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tokenData.access_token}` } })
                    .then(r => r.json()) as { id: string; username: string; email?: string; verified?: boolean; avatar?: string; discriminator?: string }
                if (!profile.email || profile.verified === false) { set.status = 400; return { error: 'A verified email is required on the Discord account.' } }
                if (providerRow.allowedDomain && profile.email.split('@')[1] !== providerRow.allowedDomain) {
                    return redirect(`${base}/login?error=domain_required&domain=${encodeURIComponent(providerRow.allowedDomain)}`)
                }
                const avatarUrl = profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : undefined
                userInfo = { id: profile.id, email: profile.email, name: profile.username, avatar: avatarUrl }

            } else {
                // All OIDC providers: google, microsoft, gitlab, okta, custom
                const oidcUrls = getOidcUrls(providerRow)
                if (!oidcUrls) { set.status = 400; return { error: 'Provider not fully configured' } }

                const tokenData = await fetch(oidcUrls.tokenUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
                    body: new URLSearchParams({ code, client_id: providerRow.clientId, client_secret: providerRow.clientSecret, redirect_uri: callbackUrl, grant_type: 'authorization_code', code_verifier: storedState.codeVerifier }),
                }).then(r => r.json()) as { access_token?: string }
                if (!tokenData.access_token) { set.status = 400; return { error: 'Failed to exchange code' } }

                const profile = await fetch(oidcUrls.userinfoUrl, { headers: { Authorization: `Bearer ${tokenData.access_token}` } })
                    .then(r => r.json()) as { sub?: string; id?: string; email: string; email_verified?: boolean; name?: string; picture?: string; avatar_url?: string }

                // Require the IdP to assert the email is verified — otherwise an attacker
                // could register an OAuth account with someone else's email and (combined
                // with email-based linking) take over that account.
                if (profile.email_verified !== true) {
                    return redirect(`${base}/login?error=email_unverified`)
                }

                if (providerRow.allowedDomain && profile.email.split('@')[1] !== providerRow.allowedDomain) {
                    return redirect(`${base}/login?error=domain_required&domain=${encodeURIComponent(providerRow.allowedDomain)}`)
                }
                userInfo = { id: profile.sub ?? profile.id ?? profile.email, email: profile.email, name: profile.name, avatar: profile.picture ?? profile.avatar_url }
            }

            const oauthUser = await findOrCreateOAuthUser({ provider, providerUserId: userInfo.id, email: userInfo.email, name: userInfo.name, avatarUrl: userInfo.avatar })

            // Maintenance mode: block non-admin OAuth logins (same check as password login)
            const [settings] = await db.select({ maintenanceModeEnabled: instanceSettings.maintenanceModeEnabled })
                .from(instanceSettings).where(eq(instanceSettings.id, 1)).limit(1)
            if (settings?.maintenanceModeEnabled && oauthUser.role !== 'admin') {
                return redirect(`${base}/login?error=maintenance`)
            }

            const sessionToken = await createSession(oauthUser.id)
            const handoffCode = await generateHandoff(sessionToken)
            return redirect(`/?code=${handoffCode}`)

        } catch (err) {
            if (err instanceof OAuthLinkError) {
                return redirect(`${base}/login?error=account_exists`)
            }
            console.error('[oauth callback]', err)
            set.status = 500; return { error: 'OAuth failed' }
        }
    }, {
        params: t.Object({ provider: t.String() }),
        query: t.Object({
            code: t.Optional(t.String()),
            state: t.Optional(t.String()),
            error: t.Optional(t.String()),
        }),
    })