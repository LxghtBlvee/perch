import { Elysia, error } from 'elysia'
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
import { instanceSettingsRoutes } from './routes/instance-settings'
import { statusPageRoutes } from './routes/status-pages'
import { agentWs } from './ws/agent'
import { liveWs } from './ws/live'
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

const app = new Elysia()
  .use(cors())
  .use(swagger({ path: '/api/docs' }))
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
  .use(statusPageRoutes)
  .use(agentWs)
  .use(liveWs)
  .use(staticPlugin({ assets: uploadsDir, prefix: '/uploads' }))
  // Let Vue handle custom domain detection at the root
  .get('/', () => Bun.file(join(webDist, 'index.html')))
  // Custom domain: Vue calls this on mount to detect if it should show a status page
  .get('/api/status-by-domain', async ({ request }) => {
    const host = request.headers.get('host')?.split(':')[0] ?? ''
    const [page] = await db.select({ slug: statusPages.slug })
      .from(statusPages)
      .where(eq(statusPages.customDomain, host))
      .limit(1)
    if (!page) return error(404, { error: 'Not a custom domain' })
    return { slug: page.slug }
  })
  .use(staticPlugin({ assets: webDist, prefix: '/' }))
  .onError(({ code }) => {
    if (code === 'NOT_FOUND') return Bun.file(join(webDist, 'index.html'))
  })
  .listen(env.port)

console.warn(`Perch hub running at http://localhost:${app.server?.port}`)
console.warn(`API docs available at http://localhost:${app.server?.port}/docs`)