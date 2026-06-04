import { pgTable, text, timestamp, integer, uuid } from 'drizzle-orm/pg-core';

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

export const healthCheckResults = pgTable('health_check_results', {
    id: uuid('id').primaryKey().defaultRandom(),
    healthCheckId: uuid('health_check_id').references(() => healthChecks.id, { onDelete: 'cascade' }).notNull(),
    status: text('status', { enum: ['up', 'down'] }).notNull(),
    latency: integer('latency'),
    checkedAt: timestamp('checked_at').defaultNow().notNull(),
});