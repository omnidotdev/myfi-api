import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { DATABASE_URL } from "lib/config/env.config";
import * as schema from "lib/db/schema";

import type { Pool as PostgresPool } from "pg";

/**
 * Postgres database pool.
 * @see https://node-postgres.com/apis/pool
 */
export const pgPool = new Pool({
  connectionString: DATABASE_URL,
});

/**
 * Create a database connection client.
 */
const createDbClient = (client: PostgresPool) =>
  drizzle({
    client,
    schema,
    casing: "snake_case",
  });

/**
 * Database connection pool.
 */
export const dbPool = createDbClient(pgPool);
