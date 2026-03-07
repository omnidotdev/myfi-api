import { defineConfig } from "drizzle-kit";

/**
 * Drizzle configuration.
 * @see https://orm.drizzle.team/docs/drizzle-config-file
 */
const drizzleConfig = defineConfig({
  dialect: "postgresql",
  schema: "src/lib/db/schema",
  out: "src/generated/drizzle",
  casing: "snake_case",
  migrations: {
    schema: "public",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

export default drizzleConfig;
