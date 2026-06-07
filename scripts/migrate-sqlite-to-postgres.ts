import fs from "node:fs";
import { hashPassword } from "../src/lib/auth/password";
import { id as genId } from "../src/lib/id";

type SqliteDatabase = {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => Record<string, unknown>[];
    get: (...params: unknown[]) => Record<string, unknown> | undefined;
    run: (...params: unknown[]) => unknown;
  };
  close: () => void;
};

type PgPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

const SQLITE_PATH = process.env.SQLITE_DATABASE_PATH || "./data/aicomic.db";
const DEFAULT_USER_EMAIL = process.env.MIGRATION_DEFAULT_USER_EMAIL;
const DEFAULT_USER_PASSWORD = process.env.MIGRATION_DEFAULT_USER_PASSWORD || "change-me-after-migration";

const MIGRATION_TABLES = [
  "projects",
  "episodes",
  "characters",
  "episode_characters",
  "storyboard_versions",
  "scenes",
  "shots",
  "shot_assets",
  "dialogues",
  "import_logs",
  "prompt_templates",
  "prompt_versions",
  "prompt_presets",
  "character_relations",
  "character_costumes",
  "mood_board_images",
  "shot_actions",
  "prompt_ab_tests",
  "tasks",
  "agents",
  "agent_bindings",
] as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function normalizeTimestamp(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    return new Date(value < 10_000_000_000 ? value * 1000 : value);
  }
  return value;
}

function normalizeRow(tableName: string, row: Record<string, unknown>, defaultUserId: string): Record<string, unknown> {
  const next = { ...row };

  for (const key of ["created_at", "updated_at", "scheduled_at"]) {
    if (next[key] !== undefined && next[key] !== null) {
      next[key] = normalizeTimestamp(next[key]);
    }
  }

  if (["projects", "prompt_templates", "agents"].includes(tableName)) {
    next.user_id = defaultUserId;
  }
  if (tableName === "prompt_presets" && next.user_id) {
    next.user_id = defaultUserId;
  }

  return next;
}

async function ensureDefaultUser(pg: PgPool): Promise<string> {
  if (!DEFAULT_USER_EMAIL) {
    throw new Error("MIGRATION_DEFAULT_USER_EMAIL is required");
  }

  const email = DEFAULT_USER_EMAIL.trim().toLowerCase();
  const existing = await pg.query("select id from users where email = $1 limit 1", [email]);
  if (existing.rows[0]?.id) return String(existing.rows[0].id);

  const userId = genId();
  await pg.query(
    `insert into users (id, email, username, password_hash, role, status, created_at, updated_at)
     values ($1, $2, $3, $4, 'admin', 'active', now(), now())`,
    [userId, email, email.split("@")[0] || "admin", hashPassword(DEFAULT_USER_PASSWORD)],
  );
  return userId;
}

async function insertRows(pg: PgPool, tableName: string, rows: Record<string, unknown>[]) {
  for (const row of rows) {
    const columns = Object.keys(row);
    if (columns.length === 0) continue;

    const columnSql = columns.map((column) => `"${column}"`).join(", ");
    const valueSql = columns.map((_, index) => `$${index + 1}`).join(", ");
    const values = columns.map((column) => row[column]);

    await pg.query(
      `insert into "${tableName}" (${columnSql}) values (${valueSql}) on conflict do nothing`,
      values,
    );
  }
}

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    throw new Error(`SQLite database not found: ${SQLITE_PATH}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3") as new (path: string) => SqliteDatabase;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as { Pool: new (config: { connectionString: string }) => PgPool };

  const sqlite = new Database(SQLITE_PATH);
  const pg = new Pool({ connectionString: requireEnv("DATABASE_URL") });

  try {
    const defaultUserId = await ensureDefaultUser(pg);

    for (const tableName of MIGRATION_TABLES) {
      const exists = sqlite
        .prepare("select name from sqlite_master where type = 'table' and name = ?")
        .get(tableName);
      if (!exists) continue;

      const rows = sqlite
        .prepare(`select * from "${tableName}"`)
        .all()
        .map((row) => normalizeRow(tableName, row, defaultUserId));

      await insertRows(pg, tableName, rows);
      console.log(`[migrate] ${tableName}: ${rows.length} rows`);
    }

    if (process.env.MIGRATE_ASSETS_TO_STORAGE === "true") {
      console.warn("[migrate] MIGRATE_ASSETS_TO_STORAGE is reserved for project-specific asset rewriting.");
    }

    console.log("[migrate] done");
  } finally {
    sqlite.close();
    await pg.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
