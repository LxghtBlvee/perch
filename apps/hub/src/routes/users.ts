import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'
import { requireAdminUser } from '../middleware/auth'
import { hashPassword, createRecoveryToken } from '../services/auth'

export const userRoutes = new Elysia({ prefix: '/api/users' })

    // List all users
    .get('/', async ({ request, set }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const rows = await db
            .select({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl, role: users.role, createdAt: users.createdAt })
            .from(users)
            .orderBy(users.createdAt)

        return rows.map(u => ({ ...u, createdAt: u.createdAt.toISOString() }))
    })

    // Create user
    .post('/', async ({ request, set, body }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const [existing] = await db.select().from(users).where(eq(users.email, body.email)).limit(1)
        if (existing) { set.status = 409; return { error: 'Email already in use' } }

        const passwordHash = await hashPassword(body.password)
        const [user] = await db
            .insert(users)
            .values({ email: body.email, passwordHash, name: body.name ?? null, role: body.role ?? 'member' })
            .returning()

        return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, createdAt: user.createdAt.toISOString() }
    }, {
        body: t.Object({
            email: t.String(),
            password: t.String(),
            name: t.Optional(t.String()),
            role: t.Optional(t.Union([t.Literal('member'), t.Literal('admin')])),
        }),
    })

    // Get user detail + last login
    .get('/:id', async ({ request, set, params }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const [user] = await db.select().from(users).where(eq(users.id, params.id)).limit(1)
        if (!user) { set.status = 404; return { error: 'User not found' } }

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.role,
            createdAt: user.createdAt.toISOString(),
            lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        }
    }, {
        params: t.Object({ id: t.String() }),
    })

    // Generate one-time recovery link
    .post('/:id/recovery-token', async ({ request, set, params }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        const [user] = await db.select().from(users).where(eq(users.id, params.id)).limit(1)
        if (!user) { set.status = 404; return { error: 'User not found' } }

        const token = await createRecoveryToken(user.id)
        return { token, path: `/api/auth/recover?token=${token}` }
    }, {
        params: t.Object({ id: t.String() }),
    })

    // Update user role
    .patch('/:id', async ({ request, set, params, body }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        if (params.id === admin.id && body.role === 'member') {
            { set.status = 400; return { error: 'Cannot demote yourself' } }
        }

        const [user] = await db
            .update(users)
            .set({ role: body.role, updatedAt: new Date() })
            .where(eq(users.id, params.id))
            .returning()

        if (!user) { set.status = 404; return { error: 'User not found' } }
        return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, createdAt: user.createdAt.toISOString() }
    }, {
        params: t.Object({ id: t.String() }),
        body: t.Object({ role: t.Union([t.Literal('member'), t.Literal('admin')]) }),
    })

    // Delete user
    .delete('/:id', async ({ request, set, params }) => {
        const admin = await requireAdminUser(request, set)
        if (!admin) return { error: set.status === 401 ? 'Unauthorized' : 'Forbidden' }

        if (params.id === admin.id) { set.status = 400; return { error: 'Cannot delete yourself' } }

        const [deleted] = await db.delete(users).where(eq(users.id, params.id)).returning()
        if (!deleted) { set.status = 404; return { error: 'User not found' } }
        return { ok: true }
    }, {
        params: t.Object({ id: t.String() }),
    })