import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "src/lib/config/drizzle.config.ts",
    "src/scripts/**/*.ts",
    "src/lib/amortization/index.ts",
  ],
  project: ["src/**/*.ts"],
  ignore: ["src/generated/**"],
  ignoreDependencies: [],
};

export default config;
