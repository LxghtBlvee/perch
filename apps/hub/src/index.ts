import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { env } from './config/env.validation'
import { statusRoutes } from './routes/status'
import { agentRoutes } from './routes/agents'
import { containerRoutes } from './routes/containers'
import { healthCheckRoutes } from './routes/health-checks'
import { agentWs } from './ws/agent'
import { liveWs } from './ws/live'
import { healthChecker } from './services/health-checker'

await healthChecker.start()

const app = new Elysia()
  .use(cors())
  .use(swagger({ path: '/docs' }))
  .use(statusRoutes)
  .use(agentRoutes)
  .use(containerRoutes)
  .use(healthCheckRoutes)
  .use(agentWs)
  .use(liveWs)
  .listen(env.port)

console.log(`Perch hub running at http://localhost:${app.server?.port}`)
console.log(`API docs available at http://localhost:${app.server?.port}/docs`)