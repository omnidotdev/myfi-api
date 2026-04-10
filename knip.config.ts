import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/lib/config/drizzle.config.ts", "src/scripts/**/*.ts"],
  project: ["src/**/*.ts"],
  ignore: ["src/generated/**"],
  ignoreDependencies: [],
};

export default config;
