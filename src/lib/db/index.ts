import path from "node:path";
import type { Pool as PgPool } from "pg";
import * as schema from "./schema";

type NodePostgresModule = typeof import("drizzle-orm/node-postgres");
type DrizzleDB = import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  pgPool: PgPool | undefined;
  drizzleDb: DrizzleDB | undefined;
};

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required and must point to PostgreSQL.");
  }
  if (url.startsWith("file:")) {
    throw new Error("SQLite DATABASE_URL values are no longer supported. Use postgres://...");
  }
  return url;
}

function getPool(): PgPool {
  if (globalForDb.pgPool) return globalForDb.pgPool;

  // Dynamic requires keep build-time bundling from touching optional native peers.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as {
    Pool: new (config: { connectionString: string; max?: number }) => PgPool;
  };

  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.pgPool = pool;
  }

  return pool;
}

function createDb(): DrizzleDB {
  if (globalForDb.drizzleDb) return globalForDb.drizzleDb;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/node-postgres") as NodePostgresModule;
  const instance = drizzle(getPool(), { schema });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.drizzleDb = instance;
  }

  return instance;
}

export async function closeDb() {
  await globalForDb.pgPool?.end();
  globalForDb.pgPool = undefined;
  globalForDb.drizzleDb = undefined;
}

export function runMigrations() {
  // Next instrumentation is synchronous in this project. Keep migration execution
  // explicit for deploy/bootstrap scripts rather than blocking app startup.
  const migrationsFolder = path.resolve("drizzle/postgres");
  console.log(`[DB] PostgreSQL migrations live in ${migrationsFolder}`);
}

export const db: DrizzleDB = new Proxy({} as DrizzleDB, {
  get(_, prop) {
    const instance = createDb();
    const value = (instance as never)[prop];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(instance);
    }
    return value;
  },
});

export type DB = typeof db;
