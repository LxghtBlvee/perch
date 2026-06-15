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
    recoveryTokenHash: text('recovery_token_hash').unique(),
    recoveryTokenExpiresAt: timestamp('recovery_token_expires_at'),
    lastLoginAt: timestamp('last_login_at'),
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
    provider: text('provider', { enum: ['github', 'google', 'custom', 'microsoft', 'gitlab', 'discord', 'okta'] }).notNull().unique(),
    enabled: boolean('enabled').notNull().default(false),
    clientId: text('client_id'),
    clientSecret: text('client_secret'),
    // Custom / OIDC fields (shared across custom, microsoft, gitlab, okta)
    customName: text('custom_name'),
    customAuthorizationUrl: text('custom_authorization_url'),
    customTokenUrl: text('custom_token_url'),
    customUserinfoUrl: text('custom_userinfo_url'),
    customScopes: text('custom_scopes'), // space-separated
    // Provider-specific config
    providerTenantId: text('provider_tenant_id'),  // Microsoft: tenant ID (default 'common')
    providerBaseUrl: text('provider_base_url'),     // GitLab: base URL / Okta: org domain
    // Org/domain restrictions
    allowedOrg: text('allowed_org'),       // GitHub: org slug
    allowedDomain: text('allowed_domain'), // Google/Microsoft/GitLab/Okta/Custom: email domain
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

export const instanceSettings = pgTable('instance_settings', {
    id: integer('id').primaryKey().default(1),
    // Sessions & security
    sessionDays: integer('session_days').notNull().default(30),
    selfRegistrationEnabled: boolean('self_registration_enabled').notNull().default(false),
    defaultUserRole: text('default_user_role', { enum: ['member', 'admin'] }).notNull().default('member'),
    loginLockoutEnabled: boolean('login_lockout_enabled').notNull().default(true),
    loginLockoutThreshold: integer('login_lockout_threshold').notNull().default(5),
    // Agents & monitoring
    agentReportInterval: integer('agent_report_interval').notNull().default(5000),
    agentReconnectDelay: integer('agent_reconnect_delay').notNull().default(5000),
    defaultHealthCheckInterval: integer('default_health_check_interval').notNull().default(60),
    defaultHealthCheckTimeout: integer('default_health_check_timeout').notNull().default(10000),
    // Alerts
    alertWebhookTimeout: integer('alert_webhook_timeout').notNull().default(10000),
    defaultAlertCooldown: integer('default_alert_cooldown').notNull().default(300),
    // Privacy
    geolocationEnabled: boolean('geolocation_enabled').notNull().default(true),
    // Retention
    metricsRetentionDays: integer('metrics_retention_days').notNull().default(30),
    alertHistoryRetentionDays: integer('alert_history_retention_days').notNull().default(90),
    healthCheckResultsRetentionDays: integer('health_check_results_retention_days').notNull().default(90),
    // Maintenance
    maintenanceModeEnabled: boolean('maintenance_mode_enabled').notNull().default(false),
    // Status pages
    statusPageEnabled: boolean('status_page_enabled').notNull().default(false),
    // Onboarding
    onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
    enabledPlatforms: text('enabled_platforms').notNull().default('["docker"]'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const statusPages = pgTable('status_pages', {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    customDomain: text('custom_domain').unique(),
    themeJson: text('theme_json'),
    isPublic: boolean('is_public').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const statusPageChecks = pgTable('status_page_checks', {
    id: uuid('id').primaryKey().defaultRandom(),
    statusPageId: uuid('status_page_id').references(() => statusPages.id, { onDelete: 'cascade' }).notNull(),
    healthCheckId: uuid('health_check_id').references(() => healthChecks.id, { onDelete: 'cascade' }).notNull(),
    displayName: text('display_name'),
    displayMode: text('display_mode', { enum: ['full_history', 'response_time', 'current_status'] }).notNull().default('full_history'),
    showUrl: boolean('show_url').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
})

export const statusPageIncidents = pgTable('status_page_incidents', {
    id: uuid('id').primaryKey().defaultRandom(),
    statusPageId: uuid('status_page_id').references(() => statusPages.id, { onDelete: 'cascade' }).notNull(),
    type: text('type', { enum: ['incident', 'maintenance'] }).notNull().default('incident'),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    // incident status
    status: text('status', { enum: ['investigating', 'identified', 'monitoring', 'resolved', 'scheduled', 'in_progress', 'completed'] }).notNull().default('investigating'),
    // maintenance scheduling
    scheduledAt: timestamp('scheduled_at'),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const statusPageSubscribers = pgTable('status_page_subscribers', {
    id: uuid('id').primaryKey().defaultRandom(),
    statusPageId: uuid('status_page_id').references(() => statusPages.id, { onDelete: 'cascade' }).notNull(),
    email: text('email').notNull(),
    unsubscribeToken: text('unsubscribe_token').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
    unique().on(t.statusPageId, t.email),
])

export const oauthAccounts = pgTable('oauth_accounts', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
    unique().on(t.provider, t.providerUserId),
]);

// Short-lived single-use codes that exchange for a session token.
// Used by OAuth callbacks and recovery links so the real session token
// never appears in a URL (and therefore never lands in server logs,
// Referer headers, or browser history).
export const sessionHandoffs = pgTable('session_handoffs', {
    id: uuid('id').primaryKey().defaultRandom(),
    codeHash: text('code_hash').notNull().unique(),
    sessionToken: text('session_token').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});