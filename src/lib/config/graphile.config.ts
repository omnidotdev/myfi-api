import { PgSimplifyInflectionPreset } from "@graphile/simplify-inflection";
import { makePgService } from "postgraphile/adaptors/pg";
import { PostGraphileAmberPreset } from "postgraphile/presets/amber";
import { PostGraphileConnectionFilterPreset } from "postgraphile-plugin-connection-filter";

import { DATABASE_URL, isDevEnv } from "./env.config";

/**
 * Graphile preset for MyFi.
 */
const graphilePreset: GraphileConfig.Preset = {
  extends: [
    PostGraphileAmberPreset,
    PgSimplifyInflectionPreset,
    PostGraphileConnectionFilterPreset,
  ],
  pgServices: [makePgService({ connectionString: DATABASE_URL })],
  grafast: { explain: isDevEnv },
  schema: {
    // Fail closed: no generated create/update/delete. Writes go through REST
    // (tenantScope also refuses every GraphQL mutation at execution)
    defaultBehavior:
      "+manyRelation:resource:connection -insert -update -delete",
  },
};

export default graphilePreset;
