import { validateSession } from '../services/auth'
import type { users } from '../db/schema'

type User = typeof users.$inferSelect

/** Extracts and validates the Bearer token from a request. Returns null if missing or invalid. */
export async function getAuthUser(request: Request): Promise<User | null> {
    const token = request.headers.get('authorization')?.slice(7) ?? null
    return token ? validateSession(token) : null
}

/** Returns the authenticated user or sets 401 and returns null. */
export async function requireAuthUser(
    request: Request,
    set: { status?: number | string }
): Promise<User | null> {
    const user = await getAuthUser(request)
    if (!user) set.status = 401
    return user
}

/** Returns the authenticated admin user or sets 401/403 and returns null. */
export async function requireAdminUser(
    request: Request,
    set: { status?: number | string }
): Promise<User | null> {
    const user = await getAuthUser(request)
    if (!user) { set.status = 401; return null }
    if (user.role !== 'admin') { set.status = 403; return null }
    return user
}