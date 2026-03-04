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
  dbCredentials: {
    url: (() => {
      const url = process.env.DATABASE_URL;

      if (!url) {
        throw new Error("DATABASE_URL environment variable is required");
      }

      return url;
    })(),
  },
});

export default drizzleConfig;
