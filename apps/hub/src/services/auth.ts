import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { users, sessions, oauthAccounts, instanceSettings } from '../db/schema'
import { env } from '../config/env.validation'

function generateToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hashToken(token: string): string {
    return new Bun.CryptoHasher('sha256').update(token).digest('hex');
};

export async function createSession(userId: string): Promise<string> {
    const token = generateToken();
    const tokenHash = hashToken(token);
    // Read sessionDays from instance settings (fall back to env)
    const [settings] = await db.select({ sessionDays: instanceSettings.sessionDays })
        .from(instanceSettings).where(eq(instanceSettings.id, 1)).limit(1)
    const sessionDays = settings?.sessionDays ?? env.sessionDays
    const expiresAt = new Date(Date.now() + sessionDays * 86_400_000);

    await db.insert(sessions).values({ userId, tokenHash, expiresAt });
    await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
    return token;
}

export async function createRecoveryToken(userId: string): Promise<string> {
    const token = generateToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    await db.update(users)
        .set({ recoveryTokenHash: tokenHash, recoveryTokenExpiresAt: expiresAt, updatedAt: new Date() })
        .where(eq(users.id, userId))
    return token
}

export async function useRecoveryToken(token: string): Promise<string | null> {
    const tokenHash = hashToken(token)
    const [user] = await db.select().from(users).where(eq(users.recoveryTokenHash, tokenHash)).limit(1)
    if (!user || !user.recoveryTokenExpiresAt) return null
    if (user.recoveryTokenExpiresAt < new Date()) {
        await db.update(users).set({ recoveryTokenHash: null, recoveryTokenExpiresAt: null }).where(eq(users.id, user.id))
        return null
    }
    // Consume token (one-time use)
    await db.update(users).set({ recoveryTokenHash: null, recoveryTokenExpiresAt: null }).where(eq(users.id, user.id))
    return createSession(user.id)
}

export async function validateSession(token: string) {
    const tokenHash = hashToken(token);
    const [row] = await db
        .select({ user: users, expiresAt: sessions.expiresAt })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.tokenHash, tokenHash))
        .limit(1)

    if (!row) return null;
    if (row.expiresAt < new Date()) {
        await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
        return null;
    }
    return row.user;
}

export async function deleteSession(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function hashPassword(password: string): Promise<string> {
    return Bun.password.hash(password, { algorithm: 'bcrypt', cost: 12 });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return Bun.password.verify(password, hash);
}

export async function findOrCreateOAuthUser(opts: {
    provider: string;
    providerUserId: string;
    email: string;
    name?: string | null;
    avatarUrl?: string | null;
}): Promise<typeof users.$inferSelect> {
    // check if this oauth account already exists
    const [existing] = await db
        .select({ user: users })
        .from(oauthAccounts)
        .innerJoin(users, eq(oauthAccounts.userId, users.id))
        .where(
            and(
                eq(oauthAccounts.provider, opts.provider),
                eq(oauthAccounts.providerUserId, opts.providerUserId)
            )
        )
        .limit(1)

    if (existing) return existing.user

    const [byEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, opts.email))
        .limit(1)

    let userId: string;

    if (byEmail) {
        userId = byEmail.id;
    } else {
        const [created] = await db
            .insert(users)
            .values({
                email: opts.email,
                name: opts.name ?? null,
                avatarUrl: opts.avatarUrl ?? null,
                role: 'member',
            })
            .returning()
        userId = created.id
    }

    await db.insert(oauthAccounts).values({
        userId,
        provider: opts.provider,
        providerUserId: opts.providerUserId,
    })

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    return user;
}

export async function seedAdmin(): Promise<void> {
    if (!env.adminEmail || !env.adminPassword) return;

    const [existing] = await db.select().from(users).limit(1);
    if (existing) return // users already exist

    const passwordHash = await hashPassword(env.adminPassword)
    await db.insert(users).values({
        email: env.adminEmail,
        passwordHash,
        role: 'admin',
        name: 'Admin',
        seeded: true,
    })
    console.warn(`[perch] Seeded admin user: ${env.adminEmail}`);
}