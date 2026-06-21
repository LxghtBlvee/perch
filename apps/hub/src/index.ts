import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { staticPlugin } from '@elysiajs/static'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import { eq, lt } from 'drizzle-orm'
import { env } from './config/env.validation'
import { db } from './db'
import { statusPages, sessions, healthCheckResults, alertHistory, instanceSettings } from './db/schema'
import { statusRoutes } from './routes/status'
import { agentRoutes } from './routes/agents'
import { containerRoutes } from './routes/containers'
import { healthCheckRoutes } from './routes/health-checks'
import { dataSourceRoutes } from './routes/data-sources'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { oauthSettingsRoutes } from './routes/oauth-settings'
import { alertRoutes } from './routes/alerts'
import { instanceSettingsRoutes, clientSettingsRoutes } from './routes/instance-settings'
import { statusPageRoutes } from './routes/status-pages'
import { agentWs } from './ws/agent'
import { liveWs } from './ws/live'
import { logsWs } from './ws/logs'
import { healthChecker } from './services/health-checker'
import { initLocation } from './services/hub-location'
import { seedAdmin } from './services/auth'

await initLocation()
await healthChecker.start()
await seedAdmin()

async function runCleanup(): Promise<void> {
    try {
        const now = new Date()

        // Delete expired sessions
        await db.delete(sessions).where(lt(sessions.expiresAt, now))

        // Read retention settings
        const [settings] = await db
            .select({
                healthCheckResultsRetentionDays: instanceSettings.healthCheckResultsRetentionDays,
                alertHistoryRetentionDays: instanceSettings.alertHistoryRetentionDays,
            })
            .from(instanceSettings)
            .where(eq(instanceSettings.id, 1))
            .limit(1)

        if (settings) {
            const hcrCutoff = new Date(now.getTime() - settings.healthCheckResultsRetentionDays * 86_400_000)
            await db.delete(healthCheckResults).where(lt(healthCheckResults.checkedAt, hcrCutoff))

            const ahCutoff = new Date(now.getTime() - settings.alertHistoryRetentionDays * 86_400_000)
            await db.delete(alertHistory).where(lt(alertHistory.triggeredAt, ahCutoff))
        }
    } catch (err) {
        console.error('[cleanup] error:', err)
    }
}

void runCleanup()
setInterval(() => void runCleanup(), 60 * 60 * 1000) // every hour

const webDist = join(process.cwd(), '../web/dist')
const uploadsDir = join(process.cwd(), 'uploads')
await mkdir(uploadsDir, { recursive: true })

// Derive allowed CORS origin: explicit base URL takes precedence, then dev wildcard, then deny
const corsOrigin: string[] | boolean = env.baseUrl
    ? [env.baseUrl.replace(/\/$/, '')]
    : Bun.env.NODE_ENV !== 'production'

const app = new Elysia()
    .use(cors({
        origin: corsOrigin,
        credentials: true,
        allowedHeaders: ['Authorization', 'Content-Type'],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }))
    .onAfterHandle(({ set }) => {
        // Security headers on every response
        const h = set.headers as Record<string, string>
        h['X-Frame-Options'] = 'DENY'
        h['X-Content-Type-Options'] = 'nosniff'
        h['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        h['Content-Security-Policy'] = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            "connect-src 'self' wss: https:",
            "frame-ancestors 'none'",
        ].join('; ')
    })
    .onError(({ code, set }) => {
        // Don't leak TypeBox schema internals to clients
        if (code === 'VALIDATION') {
            set.status = 400
            return { error: 'Invalid request body' }
        }
    })
    .use(statusRoutes)
    .use(authRoutes)
    .use(agentRoutes)
    .use(containerRoutes)
    .use(healthCheckRoutes)
    .use(dataSourceRoutes)
    .use(userRoutes)
    .use(oauthSettingsRoutes)
    .use(alertRoutes)
    .use(instanceSettingsRoutes)
    .use(clientSettingsRoutes)
    .use(statusPageRoutes)
    .use(agentWs)
    .use(liveWs)
    .use(logsWs)
    // Serve uploaded files dynamically. The static plugin snapshots the directory
    // at startup, so files uploaded later (avatars, status-page logos) would 404 and
    // fall through to the SPA fallback — i.e. render as a broken image.
    .get('/uploads/:file', async ({ params, set }) => {
        const name = params.file
        // Single path segment only — reject traversal and anything but safe chars.
        if (name.includes('..') || !/^[A-Za-z0-9._-]+$/.test(name)) { set.status = 400; return 'Bad request' }
        const file = Bun.file(join(uploadsDir, name))
        if (!(await file.exists())) { set.status = 404; return 'Not found' }
        return file
    })
    // Let Vue handle custom domain detection at the root
    .get('/', () => Bun.file(join(webDist, 'index.html')))
    // Custom domain: Vue calls this on mount to detect if it should show a status page
    .get('/api/status-by-domain', async ({ request, set }) => {
        const host = request.headers.get('host')?.split(':')[0] ?? ''
        const [page] = await db.select({ slug: statusPages.slug })
            .from(statusPages)
            .where(eq(statusPages.customDomain, host))
            .limit(1)
        if (!page) { set.status = 404; return { error: 'Not a custom domain' } }
        return { slug: page.slug }
    })
    .use(staticPlugin({ assets: webDist, prefix: '/' }))
    .onError(({ code }) => {
        if (code === 'NOT_FOUND') return Bun.file(join(webDist, 'index.html'))
    })
    .listen(env.port)

// API docs only in non-production
if (Bun.env.NODE_ENV !== 'production') {
    app.use(swagger({ path: '/api/docs' }))
    console.warn(`API docs available at http://localhost:${app.server?.port}/api/docs`)
}

console.warn(`Perch hub running at http://localhost:${app.server?.port}`)
