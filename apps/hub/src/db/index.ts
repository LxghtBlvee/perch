import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../config/env.validation'
import * as schema from './schema'

const client = postgres({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.pass,
    database: env.db.name,
});

export const db = drizzle(client, { schema });