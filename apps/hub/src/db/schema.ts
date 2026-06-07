import { pgTable, text, timestamp, integer, uuid, boolean, unique } from 'drizzle-orm/pg-core';

export const agents = pgTable('agents', {
    id: uuid('id').primaryKey(),
    hostname: text('hostname').notNull(),
    ip: text('ip').notNull(),
    firstSeen: timestamp('first_seen').defaultNow().notNull(),
    lastSeen: timestamp('last_seen').defaultNow().notNull(),
});

export const healthChecks = pgTable('health_checks', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    interval: integer('interval').notNull().default(60),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const dataSources = pgTable('data_sources', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: text('type', { enum: ['prometheus', 'loki', 'influxdb', 'graphite'] }).notNull(),
    url: text('url').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const healthCheckResults = pgTable('health_check_results', {
    id: uuid('id').primaryKey().defaultRandom(),
    healthCheckId: uuid('health_check_id').references(() => healthChecks.id, { onDelete: 'cascade' }).notNull(),
    status: text('status', { enum: ['up', 'down'] }).notNull(),
    latency: integer('latency'),
    checkedAt: timestamp('checked_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    role: text('role', { enum: ['member', 'admin'] }).notNull().default('member'),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const oauthProviders = pgTable('oauth_providers', {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider', { enum: ['github', 'google', 'custom'] }).notNull().unique(),
    enabled: boolean('enabled').notNull().default(false),
    clientId: text('client_id'),
    clientSecret: text('client_secret'),
    // Custom (e.g. Authentik) fields
    customName: text('custom_name'),
    customAuthorizationUrl: text('custom_authorization_url'),
    customTokenUrl: text('custom_token_url'),
    customUserinfoUrl: text('custom_userinfo_url'),
    customScopes: text('custom_scopes'), // space-separated
    // Org/domain restrictions
    allowedOrg: text('allowed_org'),       // GitHub: org slug — only members can sign in
    allowedDomain: text('allowed_domain'), // Google/Custom: email domain e.g. "mycompany.com"
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const oauthAccounts = pgTable('oauth_accounts', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
    unique().on(t.provider, t.providerUserId),
]);