import { pgTable, text, timestamp, integer, uuid, boolean, unique } from 'drizzle-orm/pg-core';

export const agents = pgTable('agents', {
    id: uuid('id').primaryKey(),
    hostname: text('hostname').notNull(),
    displayName: text('display_name'),
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
    seeded: boolean('seeded').notNull().default(false),
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

export const alertDestinations = pgTable('alert_destinations', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: text('type', { enum: ['discord', 'slack', 'ntfy'] }).notNull(),
    webhookUrl: text('webhook_url').notNull(),
    ntfyTopic: text('ntfy_topic'),
    ntfyPriority: text('ntfy_priority').default('default'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const alertRules = pgTable('alert_rules', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    type: text('type', { enum: ['health_check', 'container_event'] }).notNull(),
    // health_check specific
    healthCheckId: uuid('health_check_id').references(() => healthChecks.id, { onDelete: 'cascade' }),
    onStatus: text('on_status', { enum: ['down', 'up', 'both'] }),
    // container_event specific
    agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    events: text('events'), // JSON array: ["crash","restart"]
    // shared
    cooldown: integer('cooldown').notNull().default(300),
    lastFiredAt: timestamp('last_fired_at'),
    destinationId: uuid('destination_id').references(() => alertDestinations.id, { onDelete: 'cascade' }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const alertHistory = pgTable('alert_history', {
    id: uuid('id').primaryKey().defaultRandom(),
    ruleId: uuid('rule_id').references(() => alertRules.id, { onDelete: 'cascade' }).notNull(),
    triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
    detail: text('detail').notNull(),
    status: text('status', { enum: ['sent', 'failed'] }).notNull(),
    error: text('error'),
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