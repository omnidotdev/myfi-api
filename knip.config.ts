import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "src/server.ts",
    "src/lib/config/drizzle.config.ts",
    "src/scripts/**/*.ts",
  ],
  project: ["src/**/*.ts"],
  ignore: ["src/generated/**"],
  ignoreDependencies: [
    "jose",
    "@envelop/types",
  ],
  ignoreBinaries: ["createdb"],
};

export default config;
