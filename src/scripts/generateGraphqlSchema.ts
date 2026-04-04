import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { exportSchema } from "graphile-export";
import { printSchema } from "graphql";
import { makeSchema } from "postgraphile";

import graphilePreset from "lib/config/graphile.config";

/**
 * Generate a GraphQL schema from a Postgres database.
 * @see https://postgraphile.org/postgraphile/next/exporting-schema
 */
const generateGraphqlSchema = async () => {
  const { schema } = await makeSchema(graphilePreset);

  const generatedDirectory = `${__dirname}/../generated/graphql`;
  const schemaFilePath = `${generatedDirectory}/schema.executable.ts`;

  if (!existsSync(generatedDirectory))
    mkdirSync(generatedDirectory, { recursive: true });

  await exportSchema(schema, schemaFilePath, {
    mode: "typeDefs",
  });

  // prepend @ts-nocheck to suppress TS errors in generated code
  const content = readFileSync(schemaFilePath, "utf-8");
  writeFileSync(schemaFilePath, `// @ts-nocheck\n${content}`);

  writeFileSync(`${generatedDirectory}/schema.graphql`, printSchema(schema));

  console.info("[graphql:generate] Schema generated successfully");
};

await generateGraphqlSchema()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
