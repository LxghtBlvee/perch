import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { staticPlugin } from '@elysiajs/static'
import { join } from 'path'
import { env } from './config/env.validation'
import { statusRoutes } from './routes/status'
import { agentRoutes } from './routes/agents'
import { containerRoutes } from './routes/containers'
import { healthCheckRoutes } from './routes/health-checks'
import { agentWs } from './ws/agent'
import { liveWs } from './ws/live'
import { healthChecker } from './services/health-checker'

import { initLocation } from './services/hub-location'

await initLocation()
await healthChecker.start()

const webDist = join(process.cwd(), '../web/dist')

const app = new Elysia()
  .use(cors())
  .use(swagger({ path: '/docs' }))
  .use(statusRoutes)
  .use(agentRoutes)
  .use(containerRoutes)
  .use(healthCheckRoutes)
  .use(agentWs)
  .use(liveWs)
  .use(staticPlugin({ assets: webDist, prefix: '/' }))
  .onError(({ code }) => {
    if (code === 'NOT_FOUND') return Bun.file(join(webDist, 'index.html'))
  })
  .listen(env.port)

console.warn(`Perch hub running at http://localhost:${app.server?.port}`)
console.warn(`API docs available at http://localhost:${app.server?.port}/docs`)