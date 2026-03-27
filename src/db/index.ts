import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Prefer direct connection over pooler — Supavisor pooler has issues with jsonb params
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;

// Reuse connection across hot serverless invocations
const globalForDb = globalThis as unknown as { pgClient: ReturnType<typeof postgres> | undefined };

const client = globalForDb.pgClient ?? postgres(connectionString, {
  prepare: false,
  idle_timeout: 20,
  max: 1,
});

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
