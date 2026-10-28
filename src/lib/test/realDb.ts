import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "lib/db/schema";

/**
 * A real Postgres database handle for a single test, backed by PGlite (Postgres
 * compiled to WebAssembly, run in-process). Unlike {@link mockDb}, this executes
 * genuine SQL against the real migrated schema, so foreign keys, unique indexes,
 * NOT NULL, numeric precision, and transaction semantics are all enforced.
 */
export interface TestDb {
  /** Drizzle client wired to the PGlite instance with the production schema. */
  db: ReturnType<typeof createDrizzle>;
  /** Underlying PGlite instance; call `client.close()` when the test is done. */
  client: PGlite;
}

const createDrizzle = (client: PGlite) =>
  drizzle({ client, schema, casing: "snake_case" });

/**
 * Create a fresh, isolated real-Postgres database and apply the full Drizzle
 * migration set to it. Each call returns a brand-new empty database, so tests
 * do not share state. Close it with `client.close()` in an `afterAll`/`afterEach`
 * hook to free the WebAssembly instance.
 *
 * @example
 * const { db, client } = await createTestDb();
 * // ... exercise real SQL against `db` ...
 * await client.close();
 */
export const createTestDb = async (): Promise<TestDb> => {
  const client = new PGlite();
  const db = createDrizzle(client);
  // Replay the exact production migrations so the schema under test is the one
  // that ships, not a drizzle-push approximation
  await migrate(db, { migrationsFolder: "src/generated/drizzle" });
  return { db, client };
};
