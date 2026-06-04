import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'

const app = new Elysia()
  .use(cors())
  .get('/', () => ({ name: 'perch', status: 'ok' }))
  .listen(8484)

console.log(`Perch hub running at http://localhost:${app.server?.port}`)