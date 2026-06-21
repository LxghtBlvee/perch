import { eq, and, gt, ne, desc } from 'drizzle-orm'
import { db } from '../db'
import { users, sessions, oauthAccounts, instanceSettings, sessionHandoffs } from '../db/schema'
import { env } from '../config/env.validation'

/** Thrown when an OAuth login would silently link to an existing password account. */
export class OAuthLinkError extends Error {}

/** Thrown when a new OAuth account would be created but self-registration is off. */
export class RegistrationDisabledError extends Error {}

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
    // Atomic: clears the token only if it exists and hasn't expired — prevents TOCTOU
    const [user] = await db
        .update(users)
        .set({ recoveryTokenHash: null, recoveryTokenExpiresAt: null, updatedAt: new Date() })
        .where(and(
            eq(users.recoveryTokenHash, tokenHash),
            gt(users.recoveryTokenExpiresAt, new Date()),
        ))
        .returning()
    if (!user) return null
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

/** List a user's active sessions, flagging which one is the caller's current one. */
export async function listSessions(userId: string, currentToken: string) {
    const currentHash = hashToken(currentToken)
    const rows = await db
        .select({ id: sessions.id, tokenHash: sessions.tokenHash, createdAt: sessions.createdAt, expiresAt: sessions.expiresAt })
        .from(sessions)
        .where(eq(sessions.userId, userId))
        .orderBy(desc(sessions.createdAt))
    return rows.map(r => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        current: r.tokenHash === currentHash,
    }))
}

/** Revoke every session for a user except the caller's current one. */
export async function deleteOtherSessions(userId: string, currentToken: string): Promise<number> {
    const currentHash = hashToken(currentToken)
    const deleted = await db.delete(sessions)
        .where(and(eq(sessions.userId, userId), ne(sessions.tokenHash, currentHash)))
        .returning({ id: sessions.id })
    return deleted.length
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

    // No linked identity yet. Either this links to an account that already exists
    // for the email, or it's a brand-new signup gated by the self-registration setting.
    const [settings] = await db
        .select({ selfRegistrationEnabled: instanceSettings.selfRegistrationEnabled, defaultUserRole: instanceSettings.defaultUserRole })
        .from(instanceSettings)
        .where(eq(instanceSettings.id, 1))
        .limit(1)
    const selfRegistrationOpen = settings?.selfRegistrationEnabled ?? false
    const newUserRole = settings?.defaultUserRole ?? 'member'

    let userId: string
    const [byEmail] = await db.select().from(users).where(eq(users.email, opts.email)).limit(1)
    if (byEmail) {
        // Never silently take over an account that has a password. The email owner
        // must link this provider from account settings while signed in. (Without
        // this, an OAuth identity asserting an existing user's email could log in
        // as that user.)
        if (byEmail.passwordHash) {
            throw new OAuthLinkError('An account with this email already exists. Sign in with your password, then link this provider from account settings.')
        }
        // Passwordless account from a prior OAuth signup — linking a new provider
        // to it is a login, not a registration, so it isn't gated.
        userId = byEmail.id
    } else {
        // Brand-new account. Only create it if self-registration is enabled.
        if (!selfRegistrationOpen) {
            throw new RegistrationDisabledError('Self-registration is disabled. Ask an admin to create your account first.')
        }
        // Atomic upsert — ON CONFLICT DO NOTHING prevents duplicate users if two OAuth
        // logins race with the same new email address.
        const [created] = await db
            .insert(users)
            .values({
                email: opts.email,
                name: opts.name ?? null,
                avatarUrl: opts.avatarUrl ?? null,
                role: newUserRole,
            })
            .onConflictDoNothing()
            .returning()
        if (created) {
            userId = created.id
        } else {
            // Lost the insert race: another signup created the row first.
            const [raced] = await db.select().from(users).where(eq(users.email, opts.email)).limit(1)
            if (!raced) throw new Error('Unexpected: user not found after insert conflict')
            if (raced.passwordHash) {
                throw new OAuthLinkError('An account with this email already exists. Sign in with your password, then link this provider from account settings.')
            }
            userId = raced.id
        }
    }

    // Link OAuth account — ON CONFLICT DO NOTHING handles a concurrent insert race
    await db.insert(oauthAccounts).values({
        userId,
        provider: opts.provider,
        providerUserId: opts.providerUserId,
    }).onConflictDoNothing()

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    return user;
}

/**
 * Creates a short-lived single-use handoff code that can be exchanged for
 * the given session token. The code is safe to put in a redirect URL because
 * it expires in 30 seconds and is deleted on first use — the actual session
 * token never appears in a URL.
 */
export async function generateHandoff(sessionToken: string): Promise<string> {
    const code = generateToken()
    const codeHash = hashToken(code)
    const expiresAt = new Date(Date.now() + 30_000) // 30 seconds
    await db.insert(sessionHandoffs).values({ codeHash, sessionToken, expiresAt })
    return code
}

/**
 * Exchanges a handoff code for a session token. Single-use: the record is
 * deleted on success. Returns null if the code is unknown or expired.
 */
export async function exchangeHandoff(code: string): Promise<string | null> {
    const codeHash = hashToken(code)
    const [row] = await db
        .delete(sessionHandoffs)
        .where(and(
            eq(sessionHandoffs.codeHash, codeHash),
            gt(sessionHandoffs.expiresAt, new Date()),
        ))
        .returning()
    return row?.sessionToken ?? null
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