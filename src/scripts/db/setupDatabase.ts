import { execSync } from "node:child_process";

const dbName = process.env.DB_NAME || "myfi";
const dbUser = process.env.DB_USER || "myfi";

try {
  execSync(`createdb -U ${dbUser} ${dbName} 2>/dev/null || true`);
  console.info(`[db:setup] Database "${dbName}" ready`);
} catch (err) {
  console.error("[db:setup] Failed to create database:", err);
  process.exit(1);
}
