import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { staticPlugin } from '@elysiajs/static'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import { env } from './config/env.validation'
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

const webDist = join(process.cwd(), '../web/dist')
const uploadsDir = join(process.cwd(), 'uploads')
await mkdir(uploadsDir, { recursive: true })

const app = new Elysia()
  .use(cors())
  .use(swagger({ path: '/docs' }))
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
  .use(staticPlugin({ assets: webDist, prefix: '/' }))
  .onError(({ code }) => {
    if (code === 'NOT_FOUND') return Bun.file(join(webDist, 'index.html'))
  })
  .listen(env.port)

console.warn(`Perch hub running at http://localhost:${app.server?.port}`)
console.warn(`API docs available at http://localhost:${app.server?.port}/docs`)