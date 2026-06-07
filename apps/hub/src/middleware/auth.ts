import Elysia from 'elysia'
import { validateSession } from '../services/auth'

export const requireAuth = new Elysia({ name: 'require-auth' })
    .derive({ as: 'scoped' }, async ({ request, error }) => {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
        if (!token) return error(401, { error: 'Unauthorized' })
        const user = await validateSession(token)
        if (!user) return error(401, { error: 'Unauthorized' })
        return { currentUser: user }
    })

export const requireAdmin = new Elysia({ name: 'require-admin' })
    .use(requireAuth)
    .derive({ as: 'scoped' }, ({ currentUser, error }) => {
        if (currentUser.role !== 'admin') return error(403, { error: 'Forbidden' })
        return {}
    })