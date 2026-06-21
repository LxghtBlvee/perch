import { db } from '.'
import { sql } from 'drizzle-orm'

async function migrate() {
    console.warn('[db] Applying schema...')

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS agents (
            id UUID PRIMARY KEY,
            hostname TEXT NOT NULL,
            display_name TEXT,
            ip TEXT NOT NULL,
            first_seen TIMESTAMP DEFAULT NOW() NOT NULL,
            last_seen TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS health_checks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            interval INTEGER NOT NULL DEFAULT 60,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS data_sources (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            url TEXT NOT NULL,
            is_default BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS health_check_results (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            health_check_id UUID NOT NULL REFERENCES health_checks(id) ON DELETE CASCADE,
            status TEXT NOT NULL,
            latency INTEGER,
            checked_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT,
            role TEXT NOT NULL DEFAULT 'member',
            name TEXT,
            avatar_url TEXT,
            seeded BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `)
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_token_hash TEXT`)
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`)
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_token_expires_at TIMESTAMP`)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_recovery_token_hash_unique') THEN
                ALTER TABLE users ADD CONSTRAINT users_recovery_token_hash_unique UNIQUE (recovery_token_hash);
            END IF;
        END $$
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS oauth_providers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider TEXT NOT NULL UNIQUE,
            enabled BOOLEAN NOT NULL DEFAULT false,
            client_id TEXT,
            client_secret TEXT,
            custom_name TEXT,
            custom_authorization_url TEXT,
            custom_token_url TEXT,
            custom_userinfo_url TEXT,
            custom_scopes TEXT,
            allowed_org TEXT,
            allowed_domain TEXT,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `)
    await db.execute(sql`ALTER TABLE oauth_providers ADD COLUMN IF NOT EXISTS provider_tenant_id TEXT`)
    await db.execute(sql`ALTER TABLE oauth_providers ADD COLUMN IF NOT EXISTS provider_base_url TEXT`)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS alert_destinations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            webhook_url TEXT NOT NULL,
            ntfy_topic TEXT,
            ntfy_priority TEXT DEFAULT 'default',
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS alert_rules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT true,
            type TEXT NOT NULL,
            health_check_id UUID REFERENCES health_checks(id) ON DELETE CASCADE,
            on_status TEXT,
            agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
            events TEXT,
            cooldown INTEGER NOT NULL DEFAULT 300,
            last_fired_at TIMESTAMP,
            destination_id UUID NOT NULL REFERENCES alert_destinations(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS alert_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
            triggered_at TIMESTAMP DEFAULT NOW() NOT NULL,
            detail TEXT NOT NULL,
            status TEXT NOT NULL,
            error TEXT
        )
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS instance_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            session_days INTEGER NOT NULL DEFAULT 30,
            self_registration_enabled BOOLEAN NOT NULL DEFAULT false,
            default_user_role TEXT NOT NULL DEFAULT 'member',
            login_lockout_enabled BOOLEAN NOT NULL DEFAULT true,
            login_lockout_threshold INTEGER NOT NULL DEFAULT 5,
            agent_report_interval INTEGER NOT NULL DEFAULT 5000,
            agent_reconnect_delay INTEGER NOT NULL DEFAULT 5000,
            default_health_check_interval INTEGER NOT NULL DEFAULT 60,
            default_health_check_timeout INTEGER NOT NULL DEFAULT 10000,
            alert_webhook_timeout INTEGER NOT NULL DEFAULT 10000,
            default_alert_cooldown INTEGER NOT NULL DEFAULT 300,
            geolocation_enabled BOOLEAN NOT NULL DEFAULT true,
            metrics_retention_days INTEGER NOT NULL DEFAULT 30,
            alert_history_retention_days INTEGER NOT NULL DEFAULT 90,
            health_check_results_retention_days INTEGER NOT NULL DEFAULT 90,
            maintenance_mode_enabled BOOLEAN NOT NULL DEFAULT false,
            status_page_enabled BOOLEAN NOT NULL DEFAULT false,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS status_pages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            slug TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT,
            logo_url TEXT,
            custom_domain TEXT UNIQUE,
            is_public BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `)
    await db.execute(sql`ALTER TABLE status_pages ADD COLUMN IF NOT EXISTS description TEXT`)
    await db.execute(sql`ALTER TABLE status_pages ADD COLUMN IF NOT EXISTS logo_url TEXT`)
    await db.execute(sql`ALTER TABLE status_pages ADD COLUMN IF NOT EXISTS theme_json TEXT`)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'status_pages_custom_domain_unique') THEN
                ALTER TABLE status_pages ADD COLUMN IF NOT EXISTS custom_domain TEXT;
                ALTER TABLE status_pages ADD CONSTRAINT status_pages_custom_domain_unique UNIQUE (custom_domain);
            END IF;
        END $$
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS status_page_checks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
            health_check_id UUID NOT NULL REFERENCES health_checks(id) ON DELETE CASCADE,
            display_name TEXT,
            display_mode TEXT NOT NULL DEFAULT 'full_history',
            show_url BOOLEAN NOT NULL DEFAULT false,
            sort_order INTEGER NOT NULL DEFAULT 0
        )
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS status_page_incidents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
            type TEXT NOT NULL DEFAULT 'incident',
            title TEXT NOT NULL,
            body TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'investigating',
            scheduled_at TIMESTAMP,
            resolved_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS status_page_subscribers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            unsubscribe_token TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            UNIQUE(status_page_id, email)
        )
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS oauth_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider TEXT NOT NULL,
            provider_user_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            UNIQUE(provider, provider_user_id)
        )
    `)

    await db.execute(sql`ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false`)
    await db.execute(sql`ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS enabled_platforms TEXT NOT NULL DEFAULT '["docker"]'`)
    await db.execute(sql`ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS log_default_tail INTEGER NOT NULL DEFAULT 200`)
    await db.execute(sql`ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS log_default_wrap BOOLEAN NOT NULL DEFAULT true`)
    await db.execute(sql`ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS log_show_timestamps BOOLEAN NOT NULL DEFAULT true`)
    await db.execute(sql`ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS log_tag_untagged BOOLEAN NOT NULL DEFAULT true`)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS session_handoffs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code_hash TEXT NOT NULL UNIQUE,
            session_token TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `)

    // Performance indexes for cleanup queries and common lookups
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_health_check_results_checked_at ON health_check_results(checked_at)`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at ON alert_history(triggered_at)`)

    console.warn('[db] Schema applied.')
}

migrate()
    .then(() => process.exit(0))
    .catch(e => { console.error('[db] Migration failed:', e); process.exit(1) })
