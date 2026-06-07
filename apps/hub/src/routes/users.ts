import Elysia, { t } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'
import { requireAdmin } from '../middleware/auth'
import { hashPassword } from '../services/auth'

export const userRoutes = new Elysia({ prefix: '/api/users' })
    .use(requireAdmin)

    // List all users
    .get('/', async () => {
        const rows = await db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                avatarUrl: users.avatarUrl,
                role: users.role,
                createdAt: users.createdAt,
            })
            .from(users)
            .orderBy(users.createdAt)

        return rows.map(u => ({ ...u, createdAt: u.createdAt.toISOString() }))
    })

    // Create user (admin only)
    .post('/', async ({ body, error }) => {
        const [existing] = await db.select().from(users).where(eq(users.email, body.email)).limit(1)
        if (existing) return error(409, { error: 'Email already in use' })

        const passwordHash = await hashPassword(body.password)
        const [user] = await db
            .insert(users)
            .values({
                email: body.email,
                passwordHash,
                name: body.name ?? null,
                role: body.role ?? 'member',
            })
            .returning()

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.role,
            createdAt: user.createdAt.toISOString(),
        }
    }, {
        body: t.Object({
            email: t.String(),
            password: t.String(),
            name: t.Optional(t.String()),
            role: t.Optional(t.Union([t.Literal('member'), t.Literal('admin')])),
        }),
    })

    // Update user role
    .patch('/:id', async ({ params, body, currentUser, error }) => {
        // Prevent admins from demoting themselves
        if (params.id === currentUser.id && body.role === 'member') {
            return error(400, { error: 'Cannot demote yourself' })
        }

        const [user] = await db
            .update(users)
            .set({ role: body.role, updatedAt: new Date() })
            .where(eq(users.id, params.id))
            .returning()

        if (!user) return error(404, { error: 'User not found' })

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.role,
            createdAt: user.createdAt.toISOString(),
        }
    }, {
        params: t.Object({ id: t.String() }),
        body: t.Object({
            role: t.Union([t.Literal('member'), t.Literal('admin')]),
        }),
    })

    // Delete user
    .delete('/:id', async ({ params, currentUser, error }) => {
        if (params.id === currentUser.id) {
            return error(400, { error: 'Cannot delete yourself' })
        }

        const [deleted] = await db
            .delete(users)
            .where(eq(users.id, params.id))
            .returning()

        if (!deleted) return error(404, { error: 'User not found' })
        return { ok: true }
    }, {
        params: t.Object({ id: t.String() }),
    })