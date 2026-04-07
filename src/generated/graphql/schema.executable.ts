// @ts-nocheck
/* eslint-disable graphile-export/export-instances, graphile-export/export-methods, graphile-export/export-plans, graphile-export/exhaustive-deps */
import { PgCondition, PgDeleteSingleStep, PgExecutor, TYPES, assertPgClassSingleStep, enumCodec, listOfCodec, makeRegistry, pgDeleteSingle, pgInsertSingle, pgSelectFromRecord, pgUpdateSingle, recordCodec, sqlValueWithCodec } from "@dataplan/pg";
import { ConnectionStep, EdgeStep, ObjectStep, __ValueStep, access, assertStep, bakedInputRuntime, connection, constant, context, createObjectAndApplyChildren, first, get as get2, inhibitOnNull, inspect, lambda, list, makeDecodeNodeId, makeGrafastSchema, markSyncAndSafe, object, rootValue, specFromNodeId } from "grafast";
import { GraphQLError, Kind } from "graphql";
import { sql } from "pg-sql2";
const rawNodeIdCodec = {
  name: "raw",
  encode: markSyncAndSafe(function rawEncode(value) {
    return typeof value === "string" ? value : null;
  }),
  decode: markSyncAndSafe(function rawDecode(value) {
    return typeof value === "string" ? value : null;
  })
};
const nodeIdHandler_Query = {
  typeName: "Query",
  codec: rawNodeIdCodec,
  match(specifier) {
    return specifier === "query";
  },
  getIdentifiers(_value) {
    return [];
  },
  getSpec() {
    return "irrelevant";
  },
  get() {
    return rootValue();
  },
  plan() {
    return constant`query`;
  }
};
const base64JSONNodeIdCodec = {
  name: "base64JSON",
  encode: markSyncAndSafe(function base64JSONEncode(value) {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
  }),
  decode: markSyncAndSafe(function base64JSONDecode(value) {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  })
};
const nodeIdCodecs = {
  __proto__: null,
  raw: rawNodeIdCodec,
  base64JSON: base64JSONNodeIdCodec,
  pipeString: {
    name: "pipeString",
    encode: markSyncAndSafe(function pipeStringEncode(value) {
      return Array.isArray(value) ? value.join("|") : null;
    }),
    decode: markSyncAndSafe(function pipeStringDecode(value) {
      return typeof value === "string" ? value.split("|") : null;
    })
  }
};
const executor = new PgExecutor({
  name: "main",
  context() {
    const ctx = context();
    return object({
      pgSettings: ctx.get("pgSettings"),
      withPgClient: ctx.get("withPgClient")
    });
  }
});
const __drizzleMigrationsIdentifier = sql.identifier("public", "__drizzle_migrations");
const spec___drizzleMigrations = {
  name: "__drizzleMigrations",
  identifier: __drizzleMigrationsIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.int,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    hash: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.bigint,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "496030",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "__drizzle_migrations"
    }
  },
  executor: executor
};
const __drizzleMigrationsCodec = recordCodec(spec___drizzleMigrations);
const accountMappingIdentifier = sql.identifier("public", "account_mapping");
const spec_accountMapping = {
  name: "accountMapping",
  identifier: accountMappingIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    book_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    event_type: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    debit_account_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    credit_account_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    updated_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "470059",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "account_mapping"
    }
  },
  executor: executor
};
const accountMappingCodec = recordCodec(spec_accountMapping);
const journalLineIdentifier = sql.identifier("public", "journal_line");
const spec_journalLine = {
  name: "journalLine",
  identifier: journalLineIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    journal_entry_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    account_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    debit: {
      codec: TYPES.numeric,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    credit: {
      codec: TYPES.numeric,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    memo: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "470172",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "journal_line"
    }
  },
  executor: executor
};
const journalLineCodec = recordCodec(spec_journalLine);
const savingsGoalIdentifier = sql.identifier("public", "savings_goal");
const spec_savingsGoal = {
  name: "savingsGoal",
  identifier: savingsGoalIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    book_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    account_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    name: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    target_amount: {
      codec: TYPES.numeric,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    target_date: {
      codec: TYPES.timestamptz,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    updated_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "470236",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "savings_goal"
    }
  },
  executor: executor
};
const savingsGoalCodec = recordCodec(spec_savingsGoal);
const netWorthSnapshotIdentifier = sql.identifier("public", "net_worth_snapshot");
const spec_netWorthSnapshot = {
  name: "netWorthSnapshot",
  identifier: netWorthSnapshotIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    book_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    date: {
      codec: TYPES.timestamptz,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    total_assets: {
      codec: TYPES.numeric,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    total_liabilities: {
      codec: TYPES.numeric,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    net_worth: {
      codec: TYPES.numeric,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    breakdown: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "470187",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "net_worth_snapshot"
    }
  },
  executor: executor
};
const netWorthSnapshotCodec = recordCodec(spec_netWorthSnapshot);
const accountingPeriodIdentifier = sql.identifier("public", "accounting_period");
const spec_accountingPeriod = {
  name: "accountingPeriod",
  identifier: accountingPeriodIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    book_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    year: {
      codec: TYPES.int,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    month: {
      codec: TYPES.int,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    status: {
      codec: TYPES.text,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    closed_at: {
      codec: TYPES.timestamptz,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    closed_by: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    reopened_at: {
      codec: TYPES.timestamptz,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    blockers: {
      codec: TYPES.jsonb,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "639585",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "accounting_period"
    }
  },
  executor: executor
};
const accountingPeriodCodec = recordCodec(spec_accountingPeriod);
const cryptoLotIdentifier = sql.identifier("public", "crypto_lot");
const spec_cryptoLot = {
  name: "cryptoLot",
  identifier: cryptoLotIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    crypto_asset_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    acquired_at: {
      codec: TYPES.timestamptz,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    quantity: {
      codec: TYPES.numeric,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    cost_per_unit: {
      codec: TYPES.numeric,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    remaining_quantity: {
      codec: TYPES.numeric,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    disposed_at: {
      codec: TYPES.timestamptz,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    proceeds_per_unit: {
      codec: TYPES.numeric,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    journal_entry_id: {
      codec: TYPES.uuid,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "470140",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "crypto_lot"
    }
  },
  executor: executor
};
const cryptoLotCodec = recordCodec(spec_cryptoLot);
const bookIdentifier = sql.identifier("public", "book");
const bookTypeCodec = enumCodec({
  name: "bookType",
  identifier: sql.identifier("public", "book_type"),
  values: ["business", "personal"],
  description: undefined,
  extensions: {
    oid: "469962",
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "book_type"
    }
  }
});
const spec_book = {
  name: "book",
  identifier: bookIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    organization_id: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    name: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    type: {
      codec: bookTypeCodec,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    currency: {
      codec: TYPES.text,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    fiscal_year_start_month: {
      codec: TYPES.int,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    updated_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "470074",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "book"
    }
  },
  executor: executor
};
const bookCodec = recordCodec(spec_book);
const budgetIdentifier = sql.identifier("public", "budget");
const budgetPeriodCodec = enumCodec({
  name: "budgetPeriod",
  identifier: sql.identifier("public", "budget_period"),
  values: ["monthly", "quarterly", "yearly"],
  description: undefined,
  extensions: {
    oid: "469968",
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "budget_period"
    }
  }
});
const spec_budget = {
  name: "budget",
  identifier: budgetIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    book_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    account_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    amount: {
      codec: TYPES.numeric,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    period: {
      codec: budgetPeriodCodec,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    rollover: {
      codec: TYPES.boolean,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    updated_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "470092",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "budget"
    }
  },
  executor: executor
};
const budgetCodec = recordCodec(spec_budget);
const cryptoAssetIdentifier = sql.identifier("public", "crypto_asset");
const costBasisMethodCodec = enumCodec({
  name: "costBasisMethod",
  identifier: sql.identifier("public", "cost_basis_method"),
  values: ["fifo", "lifo", "hifo", "acb"],
  description: undefined,
  extensions: {
    oid: "469996",
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "cost_basis_method"
    }
  }
});
const spec_cryptoAsset = {
  name: "cryptoAsset",
  identifier: cryptoAssetIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    book_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    symbol: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    name: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    wallet_address: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    network: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    balance: {
      codec: TYPES.numeric,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    cost_basis_method: {
      codec: costBasisMethodCodec,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    last_synced_at: {
      codec: TYPES.timestamptz,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    updated_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "470122",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "crypto_asset"
    }
  },
  executor: executor
};
const cryptoAssetCodec = recordCodec(spec_cryptoAsset);
const categorizationRuleIdentifier = sql.identifier("public", "categorization_rule");
const spec_categorizationRule = {
  name: "categorizationRule",
  identifier: categorizationRuleIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    book_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    name: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    match_field: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    match_type: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    match_value: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    amount_min: {
      codec: TYPES.numeric,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    amount_max: {
      codec: TYPES.numeric,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    debit_account_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    credit_account_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    confidence: {
      codec: TYPES.numeric,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    priority: {
      codec: TYPES.int,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    hit_count: {
      codec: TYPES.int,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    last_hit_at: {
      codec: TYPES.timestamptz,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "639600",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "categorization_rule"
    }
  },
  executor: executor
};
const categorizationRuleCodec = recordCodec(spec_categorizationRule);
const journalEntryIdentifier = sql.identifier("public", "journal_entry");
const journalEntrySourceCodec = enumCodec({
  name: "journalEntrySource",
  identifier: sql.identifier("public", "journal_entry_source"),
  values: ["manual", "mantle_sync", "plaid_import", "crypto_sync", "recurring"],
  description: undefined,
  extensions: {
    oid: "470006",
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "journal_entry_source"
    }
  }
});
const spec_journalEntry = {
  name: "journalEntry",
  identifier: journalEntryIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    book_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    date: {
      codec: TYPES.timestamptz,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    memo: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    source: {
      codec: journalEntrySourceCodec,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    source_reference_id: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    is_reviewed: {
      codec: TYPES.boolean,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    is_reconciled: {
      codec: TYPES.boolean,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    updated_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "470153",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "journal_entry"
    }
  },
  executor: executor
};
const journalEntryCodec = recordCodec(spec_journalEntry);
const fixedAssetIdentifier = sql.identifier("public", "fixed_asset");
const spec_fixedAsset = {
  name: "fixedAsset",
  identifier: fixedAssetIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    book_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    name: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    description: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    asset_account_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    depreciation_expense_account_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    accumulated_depreciation_account_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    acquisition_date: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    acquisition_cost: {
      codec: TYPES.numeric,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    salvage_value: {
      codec: TYPES.numeric,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    useful_life_months: {
      codec: TYPES.int,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    depreciation_method: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    macrs_class: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    disposed_at: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    disposal_proceeds: {
      codec: TYPES.numeric,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "639661",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "fixed_asset"
    }
  },
  executor: executor
};
const fixedAssetCodec = recordCodec(spec_fixedAsset);
const recurringTransactionIdentifier = sql.identifier("public", "recurring_transaction");
const recurringFrequencyCodec = enumCodec({
  name: "recurringFrequency",
  identifier: sql.identifier("public", "recurring_frequency"),
  values: ["weekly", "biweekly", "monthly", "quarterly", "yearly"],
  description: undefined,
  extensions: {
    oid: "470028",
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "recurring_frequency"
    }
  }
});
const spec_recurringTransaction = {
  name: "recurringTransaction",
  identifier: recurringTransactionIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    book_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    name: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    amount: {
      codec: TYPES.numeric,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    frequency: {
      codec: recurringFrequencyCodec,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    account_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    counter_account_id: {
      codec: TYPES.uuid,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    is_auto_detected: {
      codec: TYPES.boolean,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    is_active: {
      codec: TYPES.boolean,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    next_expected_date: {
      codec: TYPES.timestamptz,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    updated_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "470216",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "recurring_transaction"
    }
  },
  executor: executor
};
const recurringTransactionCodec = recordCodec(spec_recurringTransaction);
const reconciliationQueueIdentifier = sql.identifier("public", "reconciliation_queue");
const reconciliationStatusCodec = enumCodec({
  name: "reconciliationStatus",
  identifier: sql.identifier("public", "reconciliation_status"),
  values: ["pending_review", "approved", "adjusted", "rejected"],
  description: undefined,
  extensions: {
    oid: "470018",
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "reconciliation_status"
    }
  }
});
const spec_reconciliationQueue = {
  name: "reconciliationQueue",
  identifier: reconciliationQueueIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    book_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    journal_entry_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    status: {
      codec: reconciliationStatusCodec,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    reviewed_at: {
      codec: TYPES.timestamptz,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    reviewed_by: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    categorization_source: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    confidence: {
      codec: TYPES.numeric,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    suggested_debit_account_id: {
      codec: TYPES.uuid,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    suggested_credit_account_id: {
      codec: TYPES.uuid,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    priority: {
      codec: TYPES.int,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    period_year: {
      codec: TYPES.int,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    period_month: {
      codec: TYPES.int,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "470202",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "reconciliation_queue"
    }
  },
  executor: executor
};
const reconciliationQueueCodec = recordCodec(spec_reconciliationQueue);
const connectedAccountProviderCodec = enumCodec({
  name: "connectedAccountProvider",
  identifier: sql.identifier("public", "connected_account_provider"),
  values: ["plaid", "mx", "wallet_connect", "exchange_api", "manual"],
  description: undefined,
  extensions: {
    oid: "469976",
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "connected_account_provider"
    }
  }
});
const accountTypeCodec = enumCodec({
  name: "accountType",
  identifier: sql.identifier("public", "account_type"),
  values: ["asset", "liability", "equity", "revenue", "expense"],
  description: undefined,
  extensions: {
    oid: "469950",
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "account_type"
    }
  }
});
const accountSubTypeCodec = enumCodec({
  name: "accountSubType",
  identifier: sql.identifier("public", "account_sub_type"),
  values: ["cash", "bank", "accounts_receivable", "inventory", "crypto_wallet", "investment", "fixed_asset", "other_asset", "credit_card", "accounts_payable", "loan", "mortgage", "other_liability", "owners_equity", "retained_earnings", "other_equity", "sales", "service_revenue", "interest_income", "crypto_gains", "other_revenue", "cost_of_goods", "operating_expense", "payroll", "tax_expense", "crypto_losses", "other_expense"],
  description: undefined,
  extensions: {
    oid: "469894",
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "account_sub_type"
    }
  }
});
const connectedAccountStatusCodec = enumCodec({
  name: "connectedAccountStatus",
  identifier: sql.identifier("public", "connected_account_status"),
  values: ["active", "disconnected", "error"],
  description: undefined,
  extensions: {
    oid: "469988",
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "connected_account_status"
    }
  }
});
const accountIdentifier = sql.identifier("public", "account");
const spec_account = {
  name: "account",
  identifier: accountIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    book_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    parent_id: {
      codec: TYPES.uuid,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    name: {
      codec: TYPES.text,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    code: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    type: {
      codec: accountTypeCodec,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    sub_type: {
      codec: accountSubTypeCodec,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    is_placeholder: {
      codec: TYPES.boolean,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    is_active: {
      codec: TYPES.boolean,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    updated_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "470041",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "account"
    }
  },
  executor: executor
};
const accountCodec = recordCodec(spec_account);
const connectedAccountIdentifier = sql.identifier("public", "connected_account");
const spec_connectedAccount = {
  name: "connectedAccount",
  identifier: connectedAccountIdentifier,
  attributes: {
    __proto__: null,
    id: {
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    book_id: {
      codec: TYPES.uuid,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    provider: {
      codec: connectedAccountProviderCodec,
      notNull: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    provider_account_id: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    account_id: {
      codec: TYPES.uuid,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    institution_name: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    mask: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    status: {
      codec: connectedAccountStatusCodec,
      notNull: true,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    access_token: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    last_synced_at: {
      codec: TYPES.timestamptz,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    created_at: {
      codec: TYPES.timestamptz,
      hasDefault: true,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    sync_cursor: {
      codec: TYPES.text,
      extensions: {
        __proto__: null,
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  extensions: {
    oid: "470108",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "connected_account"
    }
  },
  executor: executor
};
const connectedAccountCodec = recordCodec(spec_connectedAccount);
const __drizzle_migrationsUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const account_mappingUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const account_mapping_resourceOptionsConfig = {
  executor: executor,
  name: "account_mapping",
  identifier: "main.public.account_mapping",
  from: accountMappingIdentifier,
  codec: accountMappingCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "account_mapping"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: account_mappingUniques
};
const journal_lineUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const journal_line_resourceOptionsConfig = {
  executor: executor,
  name: "journal_line",
  identifier: "main.public.journal_line",
  from: journalLineIdentifier,
  codec: journalLineCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "journal_line"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: journal_lineUniques
};
const savings_goalUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const savings_goal_resourceOptionsConfig = {
  executor: executor,
  name: "savings_goal",
  identifier: "main.public.savings_goal",
  from: savingsGoalIdentifier,
  codec: savingsGoalCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "savings_goal"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: savings_goalUniques
};
const net_worth_snapshotUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const net_worth_snapshot_resourceOptionsConfig = {
  executor: executor,
  name: "net_worth_snapshot",
  identifier: "main.public.net_worth_snapshot",
  from: netWorthSnapshotIdentifier,
  codec: netWorthSnapshotCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "net_worth_snapshot"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: net_worth_snapshotUniques
};
const accounting_periodUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const accounting_period_resourceOptionsConfig = {
  executor: executor,
  name: "accounting_period",
  identifier: "main.public.accounting_period",
  from: accountingPeriodIdentifier,
  codec: accountingPeriodCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "accounting_period"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: accounting_periodUniques
};
const crypto_lotUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const crypto_lot_resourceOptionsConfig = {
  executor: executor,
  name: "crypto_lot",
  identifier: "main.public.crypto_lot",
  from: cryptoLotIdentifier,
  codec: cryptoLotCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "crypto_lot"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: crypto_lotUniques
};
const bookUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const book_resourceOptionsConfig = {
  executor: executor,
  name: "book",
  identifier: "main.public.book",
  from: bookIdentifier,
  codec: bookCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "book"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: bookUniques
};
const budgetUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const budget_resourceOptionsConfig = {
  executor: executor,
  name: "budget",
  identifier: "main.public.budget",
  from: budgetIdentifier,
  codec: budgetCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "budget"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: budgetUniques
};
const crypto_assetUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const crypto_asset_resourceOptionsConfig = {
  executor: executor,
  name: "crypto_asset",
  identifier: "main.public.crypto_asset",
  from: cryptoAssetIdentifier,
  codec: cryptoAssetCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "crypto_asset"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: crypto_assetUniques
};
const categorization_ruleUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const categorization_rule_resourceOptionsConfig = {
  executor: executor,
  name: "categorization_rule",
  identifier: "main.public.categorization_rule",
  from: categorizationRuleIdentifier,
  codec: categorizationRuleCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "categorization_rule"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: categorization_ruleUniques
};
const journal_entryUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const journal_entry_resourceOptionsConfig = {
  executor: executor,
  name: "journal_entry",
  identifier: "main.public.journal_entry",
  from: journalEntryIdentifier,
  codec: journalEntryCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "journal_entry"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: journal_entryUniques
};
const fixed_assetUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const fixed_asset_resourceOptionsConfig = {
  executor: executor,
  name: "fixed_asset",
  identifier: "main.public.fixed_asset",
  from: fixedAssetIdentifier,
  codec: fixedAssetCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "fixed_asset"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: fixed_assetUniques
};
const recurring_transactionUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const recurring_transaction_resourceOptionsConfig = {
  executor: executor,
  name: "recurring_transaction",
  identifier: "main.public.recurring_transaction",
  from: recurringTransactionIdentifier,
  codec: recurringTransactionCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "recurring_transaction"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: recurring_transactionUniques
};
const reconciliation_queueUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const reconciliation_queue_resourceOptionsConfig = {
  executor: executor,
  name: "reconciliation_queue",
  identifier: "main.public.reconciliation_queue",
  from: reconciliationQueueIdentifier,
  codec: reconciliationQueueCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "reconciliation_queue"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: reconciliation_queueUniques
};
const accountUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const account_resourceOptionsConfig = {
  executor: executor,
  name: "account",
  identifier: "main.public.account",
  from: accountIdentifier,
  codec: accountCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "account"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: accountUniques
};
const connected_accountUniques = [{
  attributes: ["id"],
  isPrimary: true
}];
const connected_account_resourceOptionsConfig = {
  executor: executor,
  name: "connected_account",
  identifier: "main.public.connected_account",
  from: connectedAccountIdentifier,
  codec: connectedAccountCodec,
  extensions: {
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "connected_account"
    },
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  },
  uniques: connected_accountUniques
};
const registryConfig = {
  pgExecutors: {
    __proto__: null,
    main: executor
  },
  pgCodecs: {
    __proto__: null,
    "__drizzleMigrations": __drizzleMigrationsCodec,
    int4: TYPES.int,
    text: TYPES.text,
    int8: TYPES.bigint,
    accountMapping: accountMappingCodec,
    uuid: TYPES.uuid,
    timestamptz: TYPES.timestamptz,
    journalLine: journalLineCodec,
    numeric: TYPES.numeric,
    savingsGoal: savingsGoalCodec,
    netWorthSnapshot: netWorthSnapshotCodec,
    accountingPeriod: accountingPeriodCodec,
    jsonb: TYPES.jsonb,
    cryptoLot: cryptoLotCodec,
    book: bookCodec,
    bookType: bookTypeCodec,
    budget: budgetCodec,
    budgetPeriod: budgetPeriodCodec,
    bool: TYPES.boolean,
    cryptoAsset: cryptoAssetCodec,
    costBasisMethod: costBasisMethodCodec,
    categorizationRule: categorizationRuleCodec,
    journalEntry: journalEntryCodec,
    journalEntrySource: journalEntrySourceCodec,
    fixedAsset: fixedAssetCodec,
    recurringTransaction: recurringTransactionCodec,
    recurringFrequency: recurringFrequencyCodec,
    reconciliationQueue: reconciliationQueueCodec,
    reconciliationStatus: reconciliationStatusCodec,
    connectedAccountProvider: connectedAccountProviderCodec,
    accountType: accountTypeCodec,
    accountSubType: accountSubTypeCodec,
    connectedAccountStatus: connectedAccountStatusCodec,
    account: accountCodec,
    connectedAccount: connectedAccountCodec
  },
  pgResources: {
    __proto__: null,
    "__drizzle_migrations": {
      executor: executor,
      name: "__drizzle_migrations",
      identifier: "main.public.__drizzle_migrations",
      from: __drizzleMigrationsIdentifier,
      codec: __drizzleMigrationsCodec,
      extensions: {
        pg: {
          serviceName: "main",
          schemaName: "public",
          name: "__drizzle_migrations"
        },
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        canDelete: true
      },
      uniques: __drizzle_migrationsUniques
    },
    account_mapping: account_mapping_resourceOptionsConfig,
    journal_line: journal_line_resourceOptionsConfig,
    savings_goal: savings_goal_resourceOptionsConfig,
    net_worth_snapshot: net_worth_snapshot_resourceOptionsConfig,
    accounting_period: accounting_period_resourceOptionsConfig,
    crypto_lot: crypto_lot_resourceOptionsConfig,
    book: book_resourceOptionsConfig,
    budget: budget_resourceOptionsConfig,
    crypto_asset: crypto_asset_resourceOptionsConfig,
    categorization_rule: categorization_rule_resourceOptionsConfig,
    journal_entry: journal_entry_resourceOptionsConfig,
    fixed_asset: fixed_asset_resourceOptionsConfig,
    recurring_transaction: recurring_transaction_resourceOptionsConfig,
    reconciliation_queue: reconciliation_queue_resourceOptionsConfig,
    account: account_resourceOptionsConfig,
    connected_account: connected_account_resourceOptionsConfig
  },
  pgRelations: {
    __proto__: null,
    account: {
      __proto__: null,
      bookByMyBookId: {
        localCodec: accountCodec,
        remoteResourceOptions: book_resourceOptionsConfig,
        localAttributes: ["book_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      accountByMyParentId: {
        localCodec: accountCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["parent_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      accountsByTheirParentId: {
        localCodec: accountCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["parent_id"],
        isReferencee: true
      },
      accountMappingsByTheirCreditAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: account_mapping_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["credit_account_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      },
      accountMappingsByTheirDebitAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: account_mapping_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["debit_account_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      },
      budgetsByTheirAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: budget_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["account_id"],
        isReferencee: true
      },
      connectedAccountsByTheirAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: connected_account_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["account_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      },
      journalLinesByTheirAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: journal_line_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["account_id"],
        isReferencee: true
      },
      reconciliationQueuesByTheirSuggestedCreditAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: reconciliation_queue_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["suggested_credit_account_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      },
      reconciliationQueuesByTheirSuggestedDebitAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: reconciliation_queue_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["suggested_debit_account_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      },
      recurringTransactionsByTheirAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: recurring_transaction_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["account_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      },
      recurringTransactionsByTheirCounterAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: recurring_transaction_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["counter_account_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      },
      savingsGoalsByTheirAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: savings_goal_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["account_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      },
      categorizationRulesByTheirCreditAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: categorization_rule_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["credit_account_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      },
      categorizationRulesByTheirDebitAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: categorization_rule_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["debit_account_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      },
      fixedAssetsByTheirAccumulatedDepreciationAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: fixed_asset_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["accumulated_depreciation_account_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      },
      fixedAssetsByTheirAssetAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: fixed_asset_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["asset_account_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      },
      fixedAssetsByTheirDepreciationExpenseAccountId: {
        localCodec: accountCodec,
        remoteResourceOptions: fixed_asset_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["depreciation_expense_account_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      }
    },
    accountMapping: {
      __proto__: null,
      bookByMyBookId: {
        localCodec: accountMappingCodec,
        remoteResourceOptions: book_resourceOptionsConfig,
        localAttributes: ["book_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      accountByMyCreditAccountId: {
        localCodec: accountMappingCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["credit_account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      accountByMyDebitAccountId: {
        localCodec: accountMappingCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["debit_account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      }
    },
    accountingPeriod: {
      __proto__: null,
      bookByMyBookId: {
        localCodec: accountingPeriodCodec,
        remoteResourceOptions: book_resourceOptionsConfig,
        localAttributes: ["book_id"],
        remoteAttributes: ["id"],
        isUnique: true
      }
    },
    book: {
      __proto__: null,
      accountsByTheirBookId: {
        localCodec: bookCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["book_id"],
        isReferencee: true
      },
      accountMappingsByTheirBookId: {
        localCodec: bookCodec,
        remoteResourceOptions: account_mapping_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["book_id"],
        isReferencee: true
      },
      budgetsByTheirBookId: {
        localCodec: bookCodec,
        remoteResourceOptions: budget_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["book_id"],
        isReferencee: true
      },
      connectedAccountsByTheirBookId: {
        localCodec: bookCodec,
        remoteResourceOptions: connected_account_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["book_id"],
        isReferencee: true
      },
      cryptoAssetsByTheirBookId: {
        localCodec: bookCodec,
        remoteResourceOptions: crypto_asset_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["book_id"],
        isReferencee: true
      },
      journalEntriesByTheirBookId: {
        localCodec: bookCodec,
        remoteResourceOptions: journal_entry_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["book_id"],
        isReferencee: true
      },
      netWorthSnapshotsByTheirBookId: {
        localCodec: bookCodec,
        remoteResourceOptions: net_worth_snapshot_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["book_id"],
        isReferencee: true
      },
      reconciliationQueuesByTheirBookId: {
        localCodec: bookCodec,
        remoteResourceOptions: reconciliation_queue_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["book_id"],
        isReferencee: true
      },
      recurringTransactionsByTheirBookId: {
        localCodec: bookCodec,
        remoteResourceOptions: recurring_transaction_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["book_id"],
        isReferencee: true
      },
      savingsGoalsByTheirBookId: {
        localCodec: bookCodec,
        remoteResourceOptions: savings_goal_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["book_id"],
        isReferencee: true
      },
      accountingPeriodsByTheirBookId: {
        localCodec: bookCodec,
        remoteResourceOptions: accounting_period_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["book_id"],
        isReferencee: true
      },
      categorizationRulesByTheirBookId: {
        localCodec: bookCodec,
        remoteResourceOptions: categorization_rule_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["book_id"],
        isReferencee: true
      },
      fixedAssetsByTheirBookId: {
        localCodec: bookCodec,
        remoteResourceOptions: fixed_asset_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["book_id"],
        isReferencee: true
      }
    },
    budget: {
      __proto__: null,
      accountByMyAccountId: {
        localCodec: budgetCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      bookByMyBookId: {
        localCodec: budgetCodec,
        remoteResourceOptions: book_resourceOptionsConfig,
        localAttributes: ["book_id"],
        remoteAttributes: ["id"],
        isUnique: true
      }
    },
    categorizationRule: {
      __proto__: null,
      bookByMyBookId: {
        localCodec: categorizationRuleCodec,
        remoteResourceOptions: book_resourceOptionsConfig,
        localAttributes: ["book_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      accountByMyCreditAccountId: {
        localCodec: categorizationRuleCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["credit_account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      accountByMyDebitAccountId: {
        localCodec: categorizationRuleCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["debit_account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      }
    },
    connectedAccount: {
      __proto__: null,
      accountByMyAccountId: {
        localCodec: connectedAccountCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      bookByMyBookId: {
        localCodec: connectedAccountCodec,
        remoteResourceOptions: book_resourceOptionsConfig,
        localAttributes: ["book_id"],
        remoteAttributes: ["id"],
        isUnique: true
      }
    },
    cryptoAsset: {
      __proto__: null,
      bookByMyBookId: {
        localCodec: cryptoAssetCodec,
        remoteResourceOptions: book_resourceOptionsConfig,
        localAttributes: ["book_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      cryptoLotsByTheirCryptoAssetId: {
        localCodec: cryptoAssetCodec,
        remoteResourceOptions: crypto_lot_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["crypto_asset_id"],
        isReferencee: true
      }
    },
    cryptoLot: {
      __proto__: null,
      cryptoAssetByMyCryptoAssetId: {
        localCodec: cryptoLotCodec,
        remoteResourceOptions: crypto_asset_resourceOptionsConfig,
        localAttributes: ["crypto_asset_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      journalEntryByMyJournalEntryId: {
        localCodec: cryptoLotCodec,
        remoteResourceOptions: journal_entry_resourceOptionsConfig,
        localAttributes: ["journal_entry_id"],
        remoteAttributes: ["id"],
        isUnique: true
      }
    },
    fixedAsset: {
      __proto__: null,
      accountByMyAccumulatedDepreciationAccountId: {
        localCodec: fixedAssetCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["accumulated_depreciation_account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      accountByMyAssetAccountId: {
        localCodec: fixedAssetCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["asset_account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      bookByMyBookId: {
        localCodec: fixedAssetCodec,
        remoteResourceOptions: book_resourceOptionsConfig,
        localAttributes: ["book_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      accountByMyDepreciationExpenseAccountId: {
        localCodec: fixedAssetCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["depreciation_expense_account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      }
    },
    journalEntry: {
      __proto__: null,
      bookByMyBookId: {
        localCodec: journalEntryCodec,
        remoteResourceOptions: book_resourceOptionsConfig,
        localAttributes: ["book_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      cryptoLotsByTheirJournalEntryId: {
        localCodec: journalEntryCodec,
        remoteResourceOptions: crypto_lot_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["journal_entry_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      },
      journalLinesByTheirJournalEntryId: {
        localCodec: journalEntryCodec,
        remoteResourceOptions: journal_line_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["journal_entry_id"],
        isReferencee: true
      },
      reconciliationQueuesByTheirJournalEntryId: {
        localCodec: journalEntryCodec,
        remoteResourceOptions: reconciliation_queue_resourceOptionsConfig,
        localAttributes: ["id"],
        remoteAttributes: ["journal_entry_id"],
        isReferencee: true,
        extensions: {
          __proto__: null,
          isIndexed: false
        }
      }
    },
    journalLine: {
      __proto__: null,
      accountByMyAccountId: {
        localCodec: journalLineCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      journalEntryByMyJournalEntryId: {
        localCodec: journalLineCodec,
        remoteResourceOptions: journal_entry_resourceOptionsConfig,
        localAttributes: ["journal_entry_id"],
        remoteAttributes: ["id"],
        isUnique: true
      }
    },
    netWorthSnapshot: {
      __proto__: null,
      bookByMyBookId: {
        localCodec: netWorthSnapshotCodec,
        remoteResourceOptions: book_resourceOptionsConfig,
        localAttributes: ["book_id"],
        remoteAttributes: ["id"],
        isUnique: true
      }
    },
    reconciliationQueue: {
      __proto__: null,
      bookByMyBookId: {
        localCodec: reconciliationQueueCodec,
        remoteResourceOptions: book_resourceOptionsConfig,
        localAttributes: ["book_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      journalEntryByMyJournalEntryId: {
        localCodec: reconciliationQueueCodec,
        remoteResourceOptions: journal_entry_resourceOptionsConfig,
        localAttributes: ["journal_entry_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      accountByMySuggestedCreditAccountId: {
        localCodec: reconciliationQueueCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["suggested_credit_account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      accountByMySuggestedDebitAccountId: {
        localCodec: reconciliationQueueCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["suggested_debit_account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      }
    },
    recurringTransaction: {
      __proto__: null,
      accountByMyAccountId: {
        localCodec: recurringTransactionCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      bookByMyBookId: {
        localCodec: recurringTransactionCodec,
        remoteResourceOptions: book_resourceOptionsConfig,
        localAttributes: ["book_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      accountByMyCounterAccountId: {
        localCodec: recurringTransactionCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["counter_account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      }
    },
    savingsGoal: {
      __proto__: null,
      accountByMyAccountId: {
        localCodec: savingsGoalCodec,
        remoteResourceOptions: account_resourceOptionsConfig,
        localAttributes: ["account_id"],
        remoteAttributes: ["id"],
        isUnique: true
      },
      bookByMyBookId: {
        localCodec: savingsGoalCodec,
        remoteResourceOptions: book_resourceOptionsConfig,
        localAttributes: ["book_id"],
        remoteAttributes: ["id"],
        isUnique: true
      }
    }
  }
};
const registry = makeRegistry(registryConfig);
const resource___drizzle_migrationsPgResource = registry.pgResources["__drizzle_migrations"];
const resource_account_mappingPgResource = registry.pgResources["account_mapping"];
const resource_journal_linePgResource = registry.pgResources["journal_line"];
const resource_savings_goalPgResource = registry.pgResources["savings_goal"];
const resource_net_worth_snapshotPgResource = registry.pgResources["net_worth_snapshot"];
const resource_accounting_periodPgResource = registry.pgResources["accounting_period"];
const resource_crypto_lotPgResource = registry.pgResources["crypto_lot"];
const resource_bookPgResource = registry.pgResources["book"];
const resource_budgetPgResource = registry.pgResources["budget"];
const resource_crypto_assetPgResource = registry.pgResources["crypto_asset"];
const resource_categorization_rulePgResource = registry.pgResources["categorization_rule"];
const resource_journal_entryPgResource = registry.pgResources["journal_entry"];
const resource_fixed_assetPgResource = registry.pgResources["fixed_asset"];
const resource_recurring_transactionPgResource = registry.pgResources["recurring_transaction"];
const resource_reconciliation_queuePgResource = registry.pgResources["reconciliation_queue"];
const resource_accountPgResource = registry.pgResources["account"];
const resource_connected_accountPgResource = registry.pgResources["connected_account"];
const makeTableNodeIdHandler = ({
  typeName,
  nodeIdCodec,
  resource,
  identifier,
  pk,
  deprecationReason
}) => {
  return {
    typeName,
    codec: nodeIdCodec,
    plan($record) {
      return list([constant(identifier, !1), ...pk.map(attribute => $record.get(attribute))]);
    },
    getSpec($list) {
      return Object.fromEntries(pk.map((attribute, index) => [attribute, inhibitOnNull(access($list, [index + 1]))]));
    },
    getIdentifiers(value) {
      return value.slice(1);
    },
    get(spec) {
      return resource.get(spec);
    },
    match(obj) {
      return obj[0] === identifier;
    },
    deprecationReason
  };
};
const nodeIdHandler__DrizzleMigration = makeTableNodeIdHandler({
  typeName: "_DrizzleMigration",
  identifier: "_DrizzleMigration",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource___drizzle_migrationsPgResource,
  pk: __drizzle_migrationsUniques[0].attributes
});
const specForHandlerCache = new Map();
function specForHandler(handler) {
  const existing = specForHandlerCache.get(handler);
  if (existing) return existing;
  const spec = markSyncAndSafe(function spec(nodeId) {
    if (nodeId == null) return null;
    try {
      const specifier = handler.codec.decode(nodeId);
      if (handler.match(specifier)) return specifier;
    } catch {}
    return null;
  }, `specifier_${handler.typeName}_${handler.codec.name}`);
  specForHandlerCache.set(handler, spec);
  return spec;
}
const nodeFetcher__DrizzleMigration = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler__DrizzleMigration));
  return nodeIdHandler__DrizzleMigration.get(nodeIdHandler__DrizzleMigration.getSpec($decoded));
};
const nodeIdHandler_AccountMapping = makeTableNodeIdHandler({
  typeName: "AccountMapping",
  identifier: "AccountMapping",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_account_mappingPgResource,
  pk: account_mappingUniques[0].attributes
});
const nodeFetcher_AccountMapping = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_AccountMapping));
  return nodeIdHandler_AccountMapping.get(nodeIdHandler_AccountMapping.getSpec($decoded));
};
const nodeIdHandler_JournalLine = makeTableNodeIdHandler({
  typeName: "JournalLine",
  identifier: "JournalLine",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_journal_linePgResource,
  pk: journal_lineUniques[0].attributes
});
const nodeFetcher_JournalLine = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_JournalLine));
  return nodeIdHandler_JournalLine.get(nodeIdHandler_JournalLine.getSpec($decoded));
};
const nodeIdHandler_SavingsGoal = makeTableNodeIdHandler({
  typeName: "SavingsGoal",
  identifier: "SavingsGoal",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_savings_goalPgResource,
  pk: savings_goalUniques[0].attributes
});
const nodeFetcher_SavingsGoal = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_SavingsGoal));
  return nodeIdHandler_SavingsGoal.get(nodeIdHandler_SavingsGoal.getSpec($decoded));
};
const nodeIdHandler_NetWorthSnapshot = makeTableNodeIdHandler({
  typeName: "NetWorthSnapshot",
  identifier: "NetWorthSnapshot",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_net_worth_snapshotPgResource,
  pk: net_worth_snapshotUniques[0].attributes
});
const nodeFetcher_NetWorthSnapshot = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_NetWorthSnapshot));
  return nodeIdHandler_NetWorthSnapshot.get(nodeIdHandler_NetWorthSnapshot.getSpec($decoded));
};
const nodeIdHandler_AccountingPeriod = makeTableNodeIdHandler({
  typeName: "AccountingPeriod",
  identifier: "AccountingPeriod",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_accounting_periodPgResource,
  pk: accounting_periodUniques[0].attributes
});
const nodeFetcher_AccountingPeriod = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_AccountingPeriod));
  return nodeIdHandler_AccountingPeriod.get(nodeIdHandler_AccountingPeriod.getSpec($decoded));
};
const nodeIdHandler_CryptoLot = makeTableNodeIdHandler({
  typeName: "CryptoLot",
  identifier: "CryptoLot",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_crypto_lotPgResource,
  pk: crypto_lotUniques[0].attributes
});
const nodeFetcher_CryptoLot = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_CryptoLot));
  return nodeIdHandler_CryptoLot.get(nodeIdHandler_CryptoLot.getSpec($decoded));
};
const nodeIdHandler_Book = makeTableNodeIdHandler({
  typeName: "Book",
  identifier: "Book",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_bookPgResource,
  pk: bookUniques[0].attributes
});
const nodeFetcher_Book = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_Book));
  return nodeIdHandler_Book.get(nodeIdHandler_Book.getSpec($decoded));
};
const nodeIdHandler_Budget = makeTableNodeIdHandler({
  typeName: "Budget",
  identifier: "Budget",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_budgetPgResource,
  pk: budgetUniques[0].attributes
});
const nodeFetcher_Budget = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_Budget));
  return nodeIdHandler_Budget.get(nodeIdHandler_Budget.getSpec($decoded));
};
const nodeIdHandler_CryptoAsset = makeTableNodeIdHandler({
  typeName: "CryptoAsset",
  identifier: "CryptoAsset",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_crypto_assetPgResource,
  pk: crypto_assetUniques[0].attributes
});
const nodeFetcher_CryptoAsset = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_CryptoAsset));
  return nodeIdHandler_CryptoAsset.get(nodeIdHandler_CryptoAsset.getSpec($decoded));
};
const nodeIdHandler_CategorizationRule = makeTableNodeIdHandler({
  typeName: "CategorizationRule",
  identifier: "CategorizationRule",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_categorization_rulePgResource,
  pk: categorization_ruleUniques[0].attributes
});
const nodeFetcher_CategorizationRule = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_CategorizationRule));
  return nodeIdHandler_CategorizationRule.get(nodeIdHandler_CategorizationRule.getSpec($decoded));
};
const nodeIdHandler_JournalEntry = makeTableNodeIdHandler({
  typeName: "JournalEntry",
  identifier: "JournalEntry",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_journal_entryPgResource,
  pk: journal_entryUniques[0].attributes
});
const nodeFetcher_JournalEntry = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_JournalEntry));
  return nodeIdHandler_JournalEntry.get(nodeIdHandler_JournalEntry.getSpec($decoded));
};
const nodeIdHandler_FixedAsset = makeTableNodeIdHandler({
  typeName: "FixedAsset",
  identifier: "FixedAsset",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_fixed_assetPgResource,
  pk: fixed_assetUniques[0].attributes
});
const nodeFetcher_FixedAsset = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_FixedAsset));
  return nodeIdHandler_FixedAsset.get(nodeIdHandler_FixedAsset.getSpec($decoded));
};
const nodeIdHandler_RecurringTransaction = makeTableNodeIdHandler({
  typeName: "RecurringTransaction",
  identifier: "RecurringTransaction",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_recurring_transactionPgResource,
  pk: recurring_transactionUniques[0].attributes
});
const nodeFetcher_RecurringTransaction = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_RecurringTransaction));
  return nodeIdHandler_RecurringTransaction.get(nodeIdHandler_RecurringTransaction.getSpec($decoded));
};
const nodeIdHandler_ReconciliationQueue = makeTableNodeIdHandler({
  typeName: "ReconciliationQueue",
  identifier: "ReconciliationQueue",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_reconciliation_queuePgResource,
  pk: reconciliation_queueUniques[0].attributes
});
const nodeFetcher_ReconciliationQueue = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_ReconciliationQueue));
  return nodeIdHandler_ReconciliationQueue.get(nodeIdHandler_ReconciliationQueue.getSpec($decoded));
};
const nodeIdHandler_Account = makeTableNodeIdHandler({
  typeName: "Account",
  identifier: "Account",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_accountPgResource,
  pk: accountUniques[0].attributes
});
const nodeFetcher_Account = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_Account));
  return nodeIdHandler_Account.get(nodeIdHandler_Account.getSpec($decoded));
};
const nodeIdHandler_ConnectedAccount = makeTableNodeIdHandler({
  typeName: "ConnectedAccount",
  identifier: "ConnectedAccount",
  nodeIdCodec: base64JSONNodeIdCodec,
  resource: resource_connected_accountPgResource,
  pk: connected_accountUniques[0].attributes
});
const nodeFetcher_ConnectedAccount = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandler_ConnectedAccount));
  return nodeIdHandler_ConnectedAccount.get(nodeIdHandler_ConnectedAccount.getSpec($decoded));
};
function applyFirstArg(_, $connection, arg) {
  $connection.setFirst(arg.getRaw());
}
function applyLastArg(_, $connection, val) {
  $connection.setLast(val.getRaw());
}
function applyOffsetArg(_, $connection, val) {
  $connection.setOffset(val.getRaw());
}
function applyBeforeArg(_, $connection, val) {
  $connection.setBefore(val.getRaw());
}
function applyAfterArg(_, $connection, val) {
  $connection.setAfter(val.getRaw());
}
function qbWhereBuilder(qb) {
  return qb.whereBuilder();
}
const applyConditionArgToConnection = (_condition, $connection, arg) => {
  const $select = $connection.getSubplan();
  arg.apply($select, qbWhereBuilder);
};
function isEmpty(o) {
  return typeof o === "object" && o !== null && Object.keys(o).length === 0;
}
function assertAllowed(value, mode) {
  if (mode === "object" && !false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (mode === "list" && !false) {
    const arr = value;
    if (arr) {
      const l = arr.length;
      for (let i = 0; i < l; i++) if (isEmpty(arr[i])) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
    }
  }
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
}
function Query__drizzleMigrationsfilterApplyPlan(_, $connection, fieldArg) {
  const $pgSelect = $connection.getSubplan();
  fieldArg.apply($pgSelect, (queryBuilder, value) => {
    assertAllowed(value, "object");
    if (value == null) return;
    const condition = new PgCondition(queryBuilder);
    return condition;
  });
}
function applyOrderByArgToConnection(parent, $connection, value) {
  const $select = $connection.getSubplan();
  value.apply($select);
}
const nodeIdHandlerByTypeName = {
  __proto__: null,
  Query: nodeIdHandler_Query,
  _DrizzleMigration: nodeIdHandler__DrizzleMigration,
  AccountMapping: nodeIdHandler_AccountMapping,
  JournalLine: nodeIdHandler_JournalLine,
  SavingsGoal: nodeIdHandler_SavingsGoal,
  NetWorthSnapshot: nodeIdHandler_NetWorthSnapshot,
  AccountingPeriod: nodeIdHandler_AccountingPeriod,
  CryptoLot: nodeIdHandler_CryptoLot,
  Book: nodeIdHandler_Book,
  Budget: nodeIdHandler_Budget,
  CryptoAsset: nodeIdHandler_CryptoAsset,
  CategorizationRule: nodeIdHandler_CategorizationRule,
  JournalEntry: nodeIdHandler_JournalEntry,
  FixedAsset: nodeIdHandler_FixedAsset,
  RecurringTransaction: nodeIdHandler_RecurringTransaction,
  ReconciliationQueue: nodeIdHandler_ReconciliationQueue,
  Account: nodeIdHandler_Account,
  ConnectedAccount: nodeIdHandler_ConnectedAccount
};
const decodeNodeId = makeDecodeNodeId(Object.values(nodeIdHandlerByTypeName));
function findTypeNameMatch(specifier) {
  if (!specifier) return null;
  for (const [typeName, typeSpec] of Object.entries(nodeIdHandlerByTypeName)) {
    const value = specifier[typeSpec.codec.name];
    if (value != null && typeSpec.match(value)) return typeName;
  }
  console.warn(`Could not find a type that matched the specifier '${inspect(specifier)}'`);
  return null;
}
const _DrizzleMigration_rowIdPlan = $record => {
  return $record.get("id");
};
const _DrizzleMigration_createdAtPlan = $record => {
  return $record.get("created_at");
};
function toString(value) {
  return "" + value;
}
const AccountMapping_bookIdPlan = $record => {
  return $record.get("book_id");
};
const AccountMapping_debitAccountIdPlan = $record => {
  return $record.get("debit_account_id");
};
const AccountMapping_creditAccountIdPlan = $record => {
  return $record.get("credit_account_id");
};
const AccountMapping_updatedAtPlan = $record => {
  return $record.get("updated_at");
};
const AccountMapping_bookPlan = $record => resource_bookPgResource.get({
  id: $record.get("book_id")
});
const AccountMapping_creditAccountPlan = $record => resource_accountPgResource.get({
  id: $record.get("credit_account_id")
});
const AccountMapping_debitAccountPlan = $record => resource_accountPgResource.get({
  id: $record.get("debit_account_id")
});
const coerce = string => {
  if (!/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(string)) throw new GraphQLError("Invalid UUID, expected 32 hexadecimal characters, optionally with hyphens");
  return string;
};
const totalCountConnectionPlan = $connection => $connection.cloneSubplanWithoutPagination("aggregate").singleAsRecord().select(sql`count(*)`, TYPES.bigint, !1);
const Account_isActivePlan = $record => {
  return $record.get("is_active");
};
function applyAttributeCondition(attributeName, attributeCodec, $condition, val) {
  $condition.where({
    type: "attribute",
    attribute: attributeName,
    callback(expression) {
      return val === null ? sql`${expression} is null` : sql`${expression} = ${sqlValueWithCodec(val, attributeCodec)}`;
    }
  });
}
const AccountCondition_rowIdApply = ($condition, val) => applyAttributeCondition("id", TYPES.uuid, $condition, val);
const AccountCondition_bookIdApply = ($condition, val) => applyAttributeCondition("book_id", TYPES.uuid, $condition, val);
const pgConnectionFilterApplyAttribute = (fieldName, attributeName, attribute, queryBuilder, value) => {
  if (value === void 0) return;
  if (!false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
  const condition = new PgCondition(queryBuilder);
  condition.extensions.pgFilterAttribute = {
    fieldName,
    attributeName,
    attribute
  };
  return condition;
};
const pgConnectionFilterApplySingleRelation = (foreignTable, foreignTableExpression, localAttributes, remoteAttributes, $where, value) => {
  assertAllowed(value, "object");
  if (value == null) return;
  const $subQuery = $where.existsPlan({
    tableExpression: foreignTableExpression,
    alias: foreignTable.name
  });
  localAttributes.forEach((localAttribute, i) => {
    const remoteAttribute = remoteAttributes[i];
    $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
  });
  return $subQuery;
};
const pgConnectionFilterApplyForwardRelationExists = (foreignTable, foreignTableExpression, localAttributes, remoteAttributes, $where, value) => {
  assertAllowed(value, "scalar");
  if (value == null) return;
  const $subQuery = $where.existsPlan({
    tableExpression: foreignTableExpression,
    alias: foreignTable.name,
    equals: value
  });
  localAttributes.forEach((localAttribute, i) => {
    const remoteAttribute = remoteAttributes[i];
    $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
  });
};
function AccountFilter_andApply($where, value) {
  assertAllowed(value, "list");
  if (value == null) return;
  return $where.andPlan();
}
function AccountFilter_orApply($where, value) {
  assertAllowed(value, "list");
  if (value == null) return;
  const $or = $where.orPlan();
  return () => $or.andPlan();
}
function AccountFilter_notApply($where, value) {
  assertAllowed(value, "object");
  if (value == null) return;
  return $where.notPlan().andPlan();
}
const pgConnectionFilterApplyFromOperator = (fieldName, resolve, resolveInput, resolveInputCodec, resolveSqlIdentifier, resolveSqlValue, $where, value) => {
  if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
  if (value === void 0) return;
  const {
      fieldName: parentFieldName,
      attributeName,
      attribute,
      codec,
      expression
    } = $where.extensions.pgFilterAttribute,
    sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
    sourceCodec = codec ?? attribute.codec,
    [sqlIdentifier, identifierCodec] = resolveSqlIdentifier ? resolveSqlIdentifier(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
  const resolvedInput = resolveInput ? resolveInput(value) : value,
    inputCodec = resolveInputCodec ? resolveInputCodec(codec ?? attribute.codec) : codec ?? attribute.codec,
    sqlValue = resolveSqlValue ? resolveSqlValue($where, value, inputCodec) : sqlValueWithCodec(resolvedInput, inputCodec),
    fragment = resolve(sqlIdentifier, sqlValue, value, $where, {
      fieldName: parentFieldName ?? null,
      operatorName: fieldName
    });
  $where.where(fragment);
};
const resolveIsNull = (i, _v, input) => sql`${i} ${input ? sql`IS NULL` : sql`IS NOT NULL`}`;
const resolveBoolean = () => TYPES.boolean;
const resolveSqlValue_null = () => sql.null;
function pgAggregatesApply_isNull($where, value) {
  return pgConnectionFilterApplyFromOperator("isNull", resolveIsNull, undefined, resolveBoolean, undefined, resolveSqlValue_null, $where, value);
}
const resolveEquality = (i, v) => sql`${i} = ${v}`;
const forceTextTypesSensitive = [TYPES.citext, TYPES.char, TYPES.bpchar];
function resolveDomains(c) {
  let current = c;
  while (current.domainOfCodec) current = current.domainOfCodec;
  return current;
}
function resolveInputCodecSensitive(c) {
  if (c.arrayOfCodec) {
    if (forceTextTypesSensitive.includes(resolveDomains(c.arrayOfCodec))) return listOfCodec(TYPES.text, {
      extensions: {
        listItemNonNull: c.extensions?.listItemNonNull
      }
    });
    return c;
  } else {
    if (forceTextTypesSensitive.includes(resolveDomains(c))) return TYPES.text;
    return c;
  }
}
function resolveSqlIdentifierSensitive(identifier, c) {
  if (c.arrayOfCodec && forceTextTypesSensitive.includes(resolveDomains(c.arrayOfCodec))) return [sql`(${identifier})::text[]`, listOfCodec(TYPES.text, {
    extensions: {
      listItemNonNull: c.extensions?.listItemNonNull
    }
  })];else if (forceTextTypesSensitive.includes(resolveDomains(c))) return [sql`(${identifier})::text`, TYPES.text];else return [identifier, c];
}
function pgAggregatesApply_equalTo($where, value) {
  return pgConnectionFilterApplyFromOperator("equalTo", resolveEquality, undefined, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
}
const resolveInequality = (i, v) => sql`${i} <> ${v}`;
function pgAggregatesApply_notEqualTo($where, value) {
  return pgConnectionFilterApplyFromOperator("notEqualTo", resolveInequality, undefined, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
}
const resolveDistinct = (i, v) => sql`${i} IS DISTINCT FROM ${v}`;
function pgAggregatesApply_distinctFrom($where, value) {
  return pgConnectionFilterApplyFromOperator("distinctFrom", resolveDistinct, undefined, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
}
const resolveNotDistinct = (i, v) => sql`${i} IS NOT DISTINCT FROM ${v}`;
function pgAggregatesApply_notDistinctFrom($where, value) {
  return pgConnectionFilterApplyFromOperator("notDistinctFrom", resolveNotDistinct, undefined, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
}
const resolveEqualsAny = (i, v) => sql`${i} = ANY(${v})`;
function resolveArrayInputCodecSensitive(c) {
  if (forceTextTypesSensitive.includes(resolveDomains(c))) return listOfCodec(TYPES.text, {
    extensions: {
      listItemNonNull: !0
    }
  });else return listOfCodec(c, {
    extensions: {
      listItemNonNull: !0
    }
  });
}
function pgAggregatesApply_in($where, value) {
  return pgConnectionFilterApplyFromOperator("in", resolveEqualsAny, undefined, resolveArrayInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
}
const resolveInequalAll = (i, v) => sql`${i} <> ALL(${v})`;
function pgAggregatesApply_notIn($where, value) {
  return pgConnectionFilterApplyFromOperator("notIn", resolveInequalAll, undefined, resolveArrayInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
}
const resolveLessThan = (i, v) => sql`${i} < ${v}`;
function pgAggregatesApply_lessThan($where, value) {
  return pgConnectionFilterApplyFromOperator("lessThan", resolveLessThan, undefined, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
}
const resolveLessThanOrEqualTo = (i, v) => sql`${i} <= ${v}`;
function pgAggregatesApply_lessThanOrEqualTo($where, value) {
  return pgConnectionFilterApplyFromOperator("lessThanOrEqualTo", resolveLessThanOrEqualTo, undefined, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
}
const resolveGreaterThan = (i, v) => sql`${i} > ${v}`;
function pgAggregatesApply_greaterThan($where, value) {
  return pgConnectionFilterApplyFromOperator("greaterThan", resolveGreaterThan, undefined, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
}
const resolveGreaterThanOrEqualTo = (i, v) => sql`${i} >= ${v}`;
function pgAggregatesApply_greaterThanOrEqualTo($where, value) {
  return pgConnectionFilterApplyFromOperator("greaterThanOrEqualTo", resolveGreaterThanOrEqualTo, undefined, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
}
function AccountToManyAccountFilter_everyApply($where, value) {
  assertAllowed(value, "object");
  if (value == null) return;
  if (!$where.extensions.pgFilterRelation) throw Error("Invalid use of filter, 'pgFilterRelation' expected");
  const {
      localAttributes,
      remoteAttributes,
      tableExpression,
      alias
    } = $where.extensions.pgFilterRelation,
    $subQuery = $where.notPlan().existsPlan({
      tableExpression,
      alias
    });
  localAttributes.forEach((localAttribute, i) => {
    const remoteAttribute = remoteAttributes[i];
    $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
  });
  return $subQuery.notPlan().andPlan();
}
function AccountToManyAccountFilter_someApply($where, value) {
  assertAllowed(value, "object");
  if (value == null) return;
  if (!$where.extensions.pgFilterRelation) throw Error("Invalid use of filter, 'pgFilterRelation' expected");
  const {
      localAttributes,
      remoteAttributes,
      tableExpression,
      alias
    } = $where.extensions.pgFilterRelation,
    $subQuery = $where.existsPlan({
      tableExpression,
      alias
    });
  localAttributes.forEach((localAttribute, i) => {
    const remoteAttribute = remoteAttributes[i];
    $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
  });
  return $subQuery;
}
function AccountToManyAccountFilter_noneApply($where, value) {
  assertAllowed(value, "object");
  if (value == null) return;
  if (!$where.extensions.pgFilterRelation) throw Error("Invalid use of filter, 'pgFilterRelation' expected");
  const {
      localAttributes,
      remoteAttributes,
      tableExpression,
      alias
    } = $where.extensions.pgFilterRelation,
    $subQuery = $where.notPlan().existsPlan({
      tableExpression,
      alias
    });
  localAttributes.forEach((localAttribute, i) => {
    const remoteAttribute = remoteAttributes[i];
    $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
  });
  return $subQuery;
}
const resolveLike = (i, v) => sql`${i} LIKE ${v}`;
function escapeLikeWildcards(input) {
  if (typeof input !== "string") throw Error("Non-string input was provided to escapeLikeWildcards");else return input.split("%").join("\\%").split("_").join("\\_");
}
const resolveInputContains = input => `%${escapeLikeWildcards(input)}%`;
const resolveNotLike = (i, v) => sql`${i} NOT LIKE ${v}`;
const resolveILike = (i, v) => sql`${i} ILIKE ${v}`;
const forceTextTypesInsensitive = [TYPES.char, TYPES.bpchar];
function resolveInputCodecInsensitive(c) {
  if (c.arrayOfCodec) {
    if (forceTextTypesInsensitive.includes(resolveDomains(c.arrayOfCodec))) return listOfCodec(TYPES.text, {
      extensions: {
        listItemNonNull: c.extensions?.listItemNonNull
      }
    });
    return c;
  } else {
    if (forceTextTypesInsensitive.includes(resolveDomains(c))) return TYPES.text;
    return c;
  }
}
function resolveSqlIdentifierInsensitive(identifier, c) {
  if (c.arrayOfCodec && forceTextTypesInsensitive.includes(resolveDomains(c.arrayOfCodec))) return [sql`(${identifier})::text[]`, listOfCodec(TYPES.text, {
    extensions: {
      listItemNonNull: c.extensions?.listItemNonNull
    }
  })];else if (forceTextTypesInsensitive.includes(resolveDomains(c))) return [sql`(${identifier})::text`, TYPES.text];else return [identifier, c];
}
const resolveNotILike = (i, v) => sql`${i} NOT ILIKE ${v}`;
const resolveInputStartsWith = input => `${escapeLikeWildcards(input)}%`;
const resolveInputEndsWith = input => `%${escapeLikeWildcards(input)}`;
function resolveInputCodecInsensitiveOperator(inputCodec) {
  return resolveDomains(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
}
function resolveSqlIdentifierInsensitiveOperator(sourceAlias, codec) {
  return resolveDomains(codec) === TYPES.citext ? [sourceAlias, codec] : [sql`lower(${sourceAlias}::text)`, TYPES.text];
}
function resolveSqlValueInsensitiveOperator(_unused, input, inputCodec) {
  const sqlValue = sqlValueWithCodec(input, inputCodec);
  if (inputCodec === TYPES.citext) return sqlValue;else return sql`lower(${sqlValue})`;
}
function resolveInputCodecInsensitiveOperator_list(inputCodec) {
  const t = resolveDomains(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
  return listOfCodec(t, {
    extensions: {
      listItemNonNull: !0
    }
  });
}
function resolveSqlValueInsensitiveOperator_list(_unused, input, inputCodec) {
  const sqlList = sqlValueWithCodec(input, inputCodec);
  if (inputCodec.arrayOfCodec === TYPES.citext) return sqlList;else return sql`(select lower(t) from unnest(${sqlList}) t)`;
}
const AccountOrderBy_ROW_ID_ASCApply = queryBuilder => {
  queryBuilder.orderBy({
    attribute: "id",
    direction: "ASC"
  });
  queryBuilder.setOrderIsUnique();
};
const AccountOrderBy_ROW_ID_DESCApply = queryBuilder => {
  queryBuilder.orderBy({
    attribute: "id",
    direction: "DESC"
  });
  queryBuilder.setOrderIsUnique();
};
const AccountOrderBy_BOOK_ID_ASCApply = queryBuilder => {
  queryBuilder.orderBy({
    attribute: "book_id",
    direction: "ASC"
  });
};
const AccountOrderBy_BOOK_ID_DESCApply = queryBuilder => {
  queryBuilder.orderBy({
    attribute: "book_id",
    direction: "DESC"
  });
};
const Budget_accountIdPlan = $record => {
  return $record.get("account_id");
};
const Budget_accountPlan = $record => resource_accountPgResource.get({
  id: $record.get("account_id")
});
const BudgetCondition_accountIdApply = ($condition, val) => applyAttributeCondition("account_id", TYPES.uuid, $condition, val);
const BudgetOrderBy_ACCOUNT_ID_ASCApply = queryBuilder => {
  queryBuilder.orderBy({
    attribute: "account_id",
    direction: "ASC"
  });
};
const BudgetOrderBy_ACCOUNT_ID_DESCApply = queryBuilder => {
  queryBuilder.orderBy({
    attribute: "account_id",
    direction: "DESC"
  });
};
const JournalLine_journalEntryIdPlan = $record => {
  return $record.get("journal_entry_id");
};
const JournalLine_journalEntryPlan = $record => resource_journal_entryPgResource.get({
  id: $record.get("journal_entry_id")
});
const ConnectedAccount_lastSyncedAtPlan = $record => {
  return $record.get("last_synced_at");
};
const CryptoLot_disposedAtPlan = $record => {
  return $record.get("disposed_at");
};
const JournalEntryCondition_dateApply = ($condition, val) => applyAttributeCondition("date", TYPES.timestamptz, $condition, val);
const JournalEntryOrderBy_DATE_ASCApply = queryBuilder => {
  queryBuilder.orderBy({
    attribute: "date",
    direction: "ASC"
  });
};
const JournalEntryOrderBy_DATE_DESCApply = queryBuilder => {
  queryBuilder.orderBy({
    attribute: "date",
    direction: "DESC"
  });
};
const JSONSerialize = value => value;
function applyInputToInsert(_, $object) {
  return $object;
}
const specFromArgs__DrizzleMigration = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler__DrizzleMigration, $nodeId);
};
function applyInputToUpdateOrDelete(_, $object) {
  return $object;
}
const specFromArgs_AccountMapping = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_AccountMapping, $nodeId);
};
const specFromArgs_JournalLine = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_JournalLine, $nodeId);
};
const specFromArgs_SavingsGoal = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_SavingsGoal, $nodeId);
};
const specFromArgs_NetWorthSnapshot = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_NetWorthSnapshot, $nodeId);
};
const specFromArgs_AccountingPeriod = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_AccountingPeriod, $nodeId);
};
const specFromArgs_CryptoLot = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_CryptoLot, $nodeId);
};
const specFromArgs_Book = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_Book, $nodeId);
};
const specFromArgs_Budget = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_Budget, $nodeId);
};
const specFromArgs_CryptoAsset = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_CryptoAsset, $nodeId);
};
const specFromArgs_CategorizationRule = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_CategorizationRule, $nodeId);
};
const specFromArgs_JournalEntry = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_JournalEntry, $nodeId);
};
const specFromArgs_FixedAsset = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_FixedAsset, $nodeId);
};
const specFromArgs_RecurringTransaction = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_RecurringTransaction, $nodeId);
};
const specFromArgs_ReconciliationQueue = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_ReconciliationQueue, $nodeId);
};
const specFromArgs_Account = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_Account, $nodeId);
};
const specFromArgs_ConnectedAccount = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandler_ConnectedAccount, $nodeId);
};
function getClientMutationIdForCreatePlan($mutation) {
  return $mutation.getStepForKey("result").getMeta("clientMutationId");
}
function planCreatePayloadResult($object) {
  return $object.get("result");
}
function queryPlan() {
  return rootValue();
}
const getPgSelectSingleFromMutationResult = (resource, pkAttributes, $mutation) => {
  const $result = $mutation.getStepForKey("result", !0);
  if (!$result) return null;
  if ($result instanceof PgDeleteSingleStep) return pgSelectFromRecord($result.resource, $result.record());else {
    const spec = pkAttributes.reduce((memo, attributeName) => {
      memo[attributeName] = $result.get(attributeName);
      return memo;
    }, Object.create(null));
    return resource.find(spec);
  }
};
const pgMutationPayloadEdge = (resource, pkAttributes, $mutation, fieldArgs) => {
  const $select = getPgSelectSingleFromMutationResult(resource, pkAttributes, $mutation);
  if (!$select) return constant(null);
  fieldArgs.apply($select, "orderBy");
  const $connection = connection($select);
  return new EdgeStep($connection, first($connection));
};
const CreateDrizzleMigrationPayload__drizzleMigrationEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource___drizzle_migrationsPgResource, __drizzle_migrationsUniques[0].attributes, $mutation, fieldArgs);
function applyClientMutationIdForCreate(qb, val) {
  qb.setMeta("clientMutationId", val);
}
function applyCreateFields(qb, arg) {
  if (arg != null) return qb.setBuilder();
}
function _DrizzleMigrationInput_rowIdApply(obj, val, info) {
  obj.set("id", bakedInputRuntime(info.schema, info.field.type, val));
}
function _DrizzleMigrationInput_hashApply(obj, val, info) {
  obj.set("hash", bakedInputRuntime(info.schema, info.field.type, val));
}
function _DrizzleMigrationInput_createdAtApply(obj, val, info) {
  obj.set("created_at", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateAccountMappingPayload_accountMappingEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_account_mappingPgResource, account_mappingUniques[0].attributes, $mutation, fieldArgs);
function AccountMappingInput_bookIdApply(obj, val, info) {
  obj.set("book_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function AccountMappingInput_eventTypeApply(obj, val, info) {
  obj.set("event_type", bakedInputRuntime(info.schema, info.field.type, val));
}
function AccountMappingInput_debitAccountIdApply(obj, val, info) {
  obj.set("debit_account_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function AccountMappingInput_creditAccountIdApply(obj, val, info) {
  obj.set("credit_account_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function AccountMappingInput_updatedAtApply(obj, val, info) {
  obj.set("updated_at", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateJournalLinePayload_journalLineEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_journal_linePgResource, journal_lineUniques[0].attributes, $mutation, fieldArgs);
function JournalLineInput_journalEntryIdApply(obj, val, info) {
  obj.set("journal_entry_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function JournalLineInput_accountIdApply(obj, val, info) {
  obj.set("account_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function JournalLineInput_debitApply(obj, val, info) {
  obj.set("debit", bakedInputRuntime(info.schema, info.field.type, val));
}
function JournalLineInput_creditApply(obj, val, info) {
  obj.set("credit", bakedInputRuntime(info.schema, info.field.type, val));
}
function JournalLineInput_memoApply(obj, val, info) {
  obj.set("memo", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateSavingsGoalPayload_savingsGoalEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_savings_goalPgResource, savings_goalUniques[0].attributes, $mutation, fieldArgs);
function SavingsGoalInput_nameApply(obj, val, info) {
  obj.set("name", bakedInputRuntime(info.schema, info.field.type, val));
}
function SavingsGoalInput_targetAmountApply(obj, val, info) {
  obj.set("target_amount", bakedInputRuntime(info.schema, info.field.type, val));
}
function SavingsGoalInput_targetDateApply(obj, val, info) {
  obj.set("target_date", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateNetWorthSnapshotPayload_netWorthSnapshotEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_net_worth_snapshotPgResource, net_worth_snapshotUniques[0].attributes, $mutation, fieldArgs);
function NetWorthSnapshotInput_dateApply(obj, val, info) {
  obj.set("date", bakedInputRuntime(info.schema, info.field.type, val));
}
function NetWorthSnapshotInput_totalAssetsApply(obj, val, info) {
  obj.set("total_assets", bakedInputRuntime(info.schema, info.field.type, val));
}
function NetWorthSnapshotInput_totalLiabilitiesApply(obj, val, info) {
  obj.set("total_liabilities", bakedInputRuntime(info.schema, info.field.type, val));
}
function NetWorthSnapshotInput_netWorthApply(obj, val, info) {
  obj.set("net_worth", bakedInputRuntime(info.schema, info.field.type, val));
}
function NetWorthSnapshotInput_breakdownApply(obj, val, info) {
  obj.set("breakdown", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateAccountingPeriodPayload_accountingPeriodEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_accounting_periodPgResource, accounting_periodUniques[0].attributes, $mutation, fieldArgs);
function AccountingPeriodInput_yearApply(obj, val, info) {
  obj.set("year", bakedInputRuntime(info.schema, info.field.type, val));
}
function AccountingPeriodInput_monthApply(obj, val, info) {
  obj.set("month", bakedInputRuntime(info.schema, info.field.type, val));
}
function AccountingPeriodInput_statusApply(obj, val, info) {
  obj.set("status", bakedInputRuntime(info.schema, info.field.type, val));
}
function AccountingPeriodInput_closedAtApply(obj, val, info) {
  obj.set("closed_at", bakedInputRuntime(info.schema, info.field.type, val));
}
function AccountingPeriodInput_closedByApply(obj, val, info) {
  obj.set("closed_by", bakedInputRuntime(info.schema, info.field.type, val));
}
function AccountingPeriodInput_reopenedAtApply(obj, val, info) {
  obj.set("reopened_at", bakedInputRuntime(info.schema, info.field.type, val));
}
function AccountingPeriodInput_blockersApply(obj, val, info) {
  obj.set("blockers", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateCryptoLotPayload_cryptoLotEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_crypto_lotPgResource, crypto_lotUniques[0].attributes, $mutation, fieldArgs);
function CryptoLotInput_cryptoAssetIdApply(obj, val, info) {
  obj.set("crypto_asset_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function CryptoLotInput_acquiredAtApply(obj, val, info) {
  obj.set("acquired_at", bakedInputRuntime(info.schema, info.field.type, val));
}
function CryptoLotInput_quantityApply(obj, val, info) {
  obj.set("quantity", bakedInputRuntime(info.schema, info.field.type, val));
}
function CryptoLotInput_costPerUnitApply(obj, val, info) {
  obj.set("cost_per_unit", bakedInputRuntime(info.schema, info.field.type, val));
}
function CryptoLotInput_remainingQuantityApply(obj, val, info) {
  obj.set("remaining_quantity", bakedInputRuntime(info.schema, info.field.type, val));
}
function CryptoLotInput_disposedAtApply(obj, val, info) {
  obj.set("disposed_at", bakedInputRuntime(info.schema, info.field.type, val));
}
function CryptoLotInput_proceedsPerUnitApply(obj, val, info) {
  obj.set("proceeds_per_unit", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateBookPayload_bookEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_bookPgResource, bookUniques[0].attributes, $mutation, fieldArgs);
function BookInput_organizationIdApply(obj, val, info) {
  obj.set("organization_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function BookInput_typeApply(obj, val, info) {
  obj.set("type", bakedInputRuntime(info.schema, info.field.type, val));
}
function BookInput_currencyApply(obj, val, info) {
  obj.set("currency", bakedInputRuntime(info.schema, info.field.type, val));
}
function BookInput_fiscalYearStartMonthApply(obj, val, info) {
  obj.set("fiscal_year_start_month", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateBudgetPayload_budgetEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_budgetPgResource, budgetUniques[0].attributes, $mutation, fieldArgs);
function BudgetInput_amountApply(obj, val, info) {
  obj.set("amount", bakedInputRuntime(info.schema, info.field.type, val));
}
function BudgetInput_periodApply(obj, val, info) {
  obj.set("period", bakedInputRuntime(info.schema, info.field.type, val));
}
function BudgetInput_rolloverApply(obj, val, info) {
  obj.set("rollover", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateCryptoAssetPayload_cryptoAssetEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_crypto_assetPgResource, crypto_assetUniques[0].attributes, $mutation, fieldArgs);
function CryptoAssetInput_symbolApply(obj, val, info) {
  obj.set("symbol", bakedInputRuntime(info.schema, info.field.type, val));
}
function CryptoAssetInput_walletAddressApply(obj, val, info) {
  obj.set("wallet_address", bakedInputRuntime(info.schema, info.field.type, val));
}
function CryptoAssetInput_networkApply(obj, val, info) {
  obj.set("network", bakedInputRuntime(info.schema, info.field.type, val));
}
function CryptoAssetInput_balanceApply(obj, val, info) {
  obj.set("balance", bakedInputRuntime(info.schema, info.field.type, val));
}
function CryptoAssetInput_costBasisMethodApply(obj, val, info) {
  obj.set("cost_basis_method", bakedInputRuntime(info.schema, info.field.type, val));
}
function CryptoAssetInput_lastSyncedAtApply(obj, val, info) {
  obj.set("last_synced_at", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateCategorizationRulePayload_categorizationRuleEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_categorization_rulePgResource, categorization_ruleUniques[0].attributes, $mutation, fieldArgs);
function CategorizationRuleInput_matchFieldApply(obj, val, info) {
  obj.set("match_field", bakedInputRuntime(info.schema, info.field.type, val));
}
function CategorizationRuleInput_matchTypeApply(obj, val, info) {
  obj.set("match_type", bakedInputRuntime(info.schema, info.field.type, val));
}
function CategorizationRuleInput_matchValueApply(obj, val, info) {
  obj.set("match_value", bakedInputRuntime(info.schema, info.field.type, val));
}
function CategorizationRuleInput_amountMinApply(obj, val, info) {
  obj.set("amount_min", bakedInputRuntime(info.schema, info.field.type, val));
}
function CategorizationRuleInput_amountMaxApply(obj, val, info) {
  obj.set("amount_max", bakedInputRuntime(info.schema, info.field.type, val));
}
function CategorizationRuleInput_confidenceApply(obj, val, info) {
  obj.set("confidence", bakedInputRuntime(info.schema, info.field.type, val));
}
function CategorizationRuleInput_priorityApply(obj, val, info) {
  obj.set("priority", bakedInputRuntime(info.schema, info.field.type, val));
}
function CategorizationRuleInput_hitCountApply(obj, val, info) {
  obj.set("hit_count", bakedInputRuntime(info.schema, info.field.type, val));
}
function CategorizationRuleInput_lastHitAtApply(obj, val, info) {
  obj.set("last_hit_at", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateJournalEntryPayload_journalEntryEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_journal_entryPgResource, journal_entryUniques[0].attributes, $mutation, fieldArgs);
function JournalEntryInput_sourceApply(obj, val, info) {
  obj.set("source", bakedInputRuntime(info.schema, info.field.type, val));
}
function JournalEntryInput_sourceReferenceIdApply(obj, val, info) {
  obj.set("source_reference_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function JournalEntryInput_isReviewedApply(obj, val, info) {
  obj.set("is_reviewed", bakedInputRuntime(info.schema, info.field.type, val));
}
function JournalEntryInput_isReconciledApply(obj, val, info) {
  obj.set("is_reconciled", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateFixedAssetPayload_fixedAssetEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_fixed_assetPgResource, fixed_assetUniques[0].attributes, $mutation, fieldArgs);
function FixedAssetInput_descriptionApply(obj, val, info) {
  obj.set("description", bakedInputRuntime(info.schema, info.field.type, val));
}
function FixedAssetInput_assetAccountIdApply(obj, val, info) {
  obj.set("asset_account_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function FixedAssetInput_depreciationExpenseAccountIdApply(obj, val, info) {
  obj.set("depreciation_expense_account_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function FixedAssetInput_accumulatedDepreciationAccountIdApply(obj, val, info) {
  obj.set("accumulated_depreciation_account_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function FixedAssetInput_acquisitionDateApply(obj, val, info) {
  obj.set("acquisition_date", bakedInputRuntime(info.schema, info.field.type, val));
}
function FixedAssetInput_acquisitionCostApply(obj, val, info) {
  obj.set("acquisition_cost", bakedInputRuntime(info.schema, info.field.type, val));
}
function FixedAssetInput_salvageValueApply(obj, val, info) {
  obj.set("salvage_value", bakedInputRuntime(info.schema, info.field.type, val));
}
function FixedAssetInput_usefulLifeMonthsApply(obj, val, info) {
  obj.set("useful_life_months", bakedInputRuntime(info.schema, info.field.type, val));
}
function FixedAssetInput_depreciationMethodApply(obj, val, info) {
  obj.set("depreciation_method", bakedInputRuntime(info.schema, info.field.type, val));
}
function FixedAssetInput_macrsClassApply(obj, val, info) {
  obj.set("macrs_class", bakedInputRuntime(info.schema, info.field.type, val));
}
function FixedAssetInput_disposalProceedsApply(obj, val, info) {
  obj.set("disposal_proceeds", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateRecurringTransactionPayload_recurringTransactionEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_recurring_transactionPgResource, recurring_transactionUniques[0].attributes, $mutation, fieldArgs);
function RecurringTransactionInput_frequencyApply(obj, val, info) {
  obj.set("frequency", bakedInputRuntime(info.schema, info.field.type, val));
}
function RecurringTransactionInput_counterAccountIdApply(obj, val, info) {
  obj.set("counter_account_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function RecurringTransactionInput_isAutoDetectedApply(obj, val, info) {
  obj.set("is_auto_detected", bakedInputRuntime(info.schema, info.field.type, val));
}
function RecurringTransactionInput_isActiveApply(obj, val, info) {
  obj.set("is_active", bakedInputRuntime(info.schema, info.field.type, val));
}
function RecurringTransactionInput_nextExpectedDateApply(obj, val, info) {
  obj.set("next_expected_date", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateReconciliationQueuePayload_reconciliationQueueEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_reconciliation_queuePgResource, reconciliation_queueUniques[0].attributes, $mutation, fieldArgs);
function ReconciliationQueueInput_reviewedAtApply(obj, val, info) {
  obj.set("reviewed_at", bakedInputRuntime(info.schema, info.field.type, val));
}
function ReconciliationQueueInput_reviewedByApply(obj, val, info) {
  obj.set("reviewed_by", bakedInputRuntime(info.schema, info.field.type, val));
}
function ReconciliationQueueInput_categorizationSourceApply(obj, val, info) {
  obj.set("categorization_source", bakedInputRuntime(info.schema, info.field.type, val));
}
function ReconciliationQueueInput_suggestedDebitAccountIdApply(obj, val, info) {
  obj.set("suggested_debit_account_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function ReconciliationQueueInput_suggestedCreditAccountIdApply(obj, val, info) {
  obj.set("suggested_credit_account_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function ReconciliationQueueInput_periodYearApply(obj, val, info) {
  obj.set("period_year", bakedInputRuntime(info.schema, info.field.type, val));
}
function ReconciliationQueueInput_periodMonthApply(obj, val, info) {
  obj.set("period_month", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateAccountPayload_accountEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_accountPgResource, accountUniques[0].attributes, $mutation, fieldArgs);
function AccountInput_parentIdApply(obj, val, info) {
  obj.set("parent_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function AccountInput_codeApply(obj, val, info) {
  obj.set("code", bakedInputRuntime(info.schema, info.field.type, val));
}
function AccountInput_subTypeApply(obj, val, info) {
  obj.set("sub_type", bakedInputRuntime(info.schema, info.field.type, val));
}
function AccountInput_isPlaceholderApply(obj, val, info) {
  obj.set("is_placeholder", bakedInputRuntime(info.schema, info.field.type, val));
}
const CreateConnectedAccountPayload_connectedAccountEdgePlan = ($mutation, fieldArgs) => pgMutationPayloadEdge(resource_connected_accountPgResource, connected_accountUniques[0].attributes, $mutation, fieldArgs);
function ConnectedAccountInput_providerApply(obj, val, info) {
  obj.set("provider", bakedInputRuntime(info.schema, info.field.type, val));
}
function ConnectedAccountInput_providerAccountIdApply(obj, val, info) {
  obj.set("provider_account_id", bakedInputRuntime(info.schema, info.field.type, val));
}
function ConnectedAccountInput_institutionNameApply(obj, val, info) {
  obj.set("institution_name", bakedInputRuntime(info.schema, info.field.type, val));
}
function ConnectedAccountInput_maskApply(obj, val, info) {
  obj.set("mask", bakedInputRuntime(info.schema, info.field.type, val));
}
function ConnectedAccountInput_accessTokenApply(obj, val, info) {
  obj.set("access_token", bakedInputRuntime(info.schema, info.field.type, val));
}
function ConnectedAccountInput_syncCursorApply(obj, val, info) {
  obj.set("sync_cursor", bakedInputRuntime(info.schema, info.field.type, val));
}
export const typeDefs = /* GraphQL */`"""The root query type which gives access points into the data universe."""
type Query implements Node {
  """
  Exposes the root query type nested one level down. This is helpful for Relay 1
  which can only query top level fields if they are in a particular form.
  """
  query: Query!

  """
  The root query type must be a \`Node\` to work well with Relay 1 mutations. This just resolves to \`query\`.
  """
  id: ID!

  """Fetches an object given its globally unique \`ID\`."""
  node(
    """The globally unique \`ID\`."""
    id: ID!
  ): Node

  """Get a single \`_DrizzleMigration\`."""
  _drizzleMigration(rowId: Int!): _DrizzleMigration

  """Get a single \`AccountMapping\`."""
  accountMapping(rowId: UUID!): AccountMapping

  """Get a single \`JournalLine\`."""
  journalLine(rowId: UUID!): JournalLine

  """Get a single \`SavingsGoal\`."""
  savingsGoal(rowId: UUID!): SavingsGoal

  """Get a single \`NetWorthSnapshot\`."""
  netWorthSnapshot(rowId: UUID!): NetWorthSnapshot

  """Get a single \`AccountingPeriod\`."""
  accountingPeriod(rowId: UUID!): AccountingPeriod

  """Get a single \`CryptoLot\`."""
  cryptoLot(rowId: UUID!): CryptoLot

  """Get a single \`Book\`."""
  book(rowId: UUID!): Book

  """Get a single \`Budget\`."""
  budget(rowId: UUID!): Budget

  """Get a single \`CryptoAsset\`."""
  cryptoAsset(rowId: UUID!): CryptoAsset

  """Get a single \`CategorizationRule\`."""
  categorizationRule(rowId: UUID!): CategorizationRule

  """Get a single \`JournalEntry\`."""
  journalEntry(rowId: UUID!): JournalEntry

  """Get a single \`FixedAsset\`."""
  fixedAsset(rowId: UUID!): FixedAsset

  """Get a single \`RecurringTransaction\`."""
  recurringTransaction(rowId: UUID!): RecurringTransaction

  """Get a single \`ReconciliationQueue\`."""
  reconciliationQueue(rowId: UUID!): ReconciliationQueue

  """Get a single \`Account\`."""
  account(rowId: UUID!): Account

  """Get a single \`ConnectedAccount\`."""
  connectedAccount(rowId: UUID!): ConnectedAccount

  """Reads a single \`_DrizzleMigration\` using its globally unique \`ID\`."""
  _drizzleMigrationById(
    """
    The globally unique \`ID\` to be used in selecting a single \`_DrizzleMigration\`.
    """
    id: ID!
  ): _DrizzleMigration

  """Reads a single \`AccountMapping\` using its globally unique \`ID\`."""
  accountMappingById(
    """
    The globally unique \`ID\` to be used in selecting a single \`AccountMapping\`.
    """
    id: ID!
  ): AccountMapping

  """Reads a single \`JournalLine\` using its globally unique \`ID\`."""
  journalLineById(
    """
    The globally unique \`ID\` to be used in selecting a single \`JournalLine\`.
    """
    id: ID!
  ): JournalLine

  """Reads a single \`SavingsGoal\` using its globally unique \`ID\`."""
  savingsGoalById(
    """
    The globally unique \`ID\` to be used in selecting a single \`SavingsGoal\`.
    """
    id: ID!
  ): SavingsGoal

  """Reads a single \`NetWorthSnapshot\` using its globally unique \`ID\`."""
  netWorthSnapshotById(
    """
    The globally unique \`ID\` to be used in selecting a single \`NetWorthSnapshot\`.
    """
    id: ID!
  ): NetWorthSnapshot

  """Reads a single \`AccountingPeriod\` using its globally unique \`ID\`."""
  accountingPeriodById(
    """
    The globally unique \`ID\` to be used in selecting a single \`AccountingPeriod\`.
    """
    id: ID!
  ): AccountingPeriod

  """Reads a single \`CryptoLot\` using its globally unique \`ID\`."""
  cryptoLotById(
    """The globally unique \`ID\` to be used in selecting a single \`CryptoLot\`."""
    id: ID!
  ): CryptoLot

  """Reads a single \`Book\` using its globally unique \`ID\`."""
  bookById(
    """The globally unique \`ID\` to be used in selecting a single \`Book\`."""
    id: ID!
  ): Book

  """Reads a single \`Budget\` using its globally unique \`ID\`."""
  budgetById(
    """The globally unique \`ID\` to be used in selecting a single \`Budget\`."""
    id: ID!
  ): Budget

  """Reads a single \`CryptoAsset\` using its globally unique \`ID\`."""
  cryptoAssetById(
    """
    The globally unique \`ID\` to be used in selecting a single \`CryptoAsset\`.
    """
    id: ID!
  ): CryptoAsset

  """Reads a single \`CategorizationRule\` using its globally unique \`ID\`."""
  categorizationRuleById(
    """
    The globally unique \`ID\` to be used in selecting a single \`CategorizationRule\`.
    """
    id: ID!
  ): CategorizationRule

  """Reads a single \`JournalEntry\` using its globally unique \`ID\`."""
  journalEntryById(
    """
    The globally unique \`ID\` to be used in selecting a single \`JournalEntry\`.
    """
    id: ID!
  ): JournalEntry

  """Reads a single \`FixedAsset\` using its globally unique \`ID\`."""
  fixedAssetById(
    """
    The globally unique \`ID\` to be used in selecting a single \`FixedAsset\`.
    """
    id: ID!
  ): FixedAsset

  """Reads a single \`RecurringTransaction\` using its globally unique \`ID\`."""
  recurringTransactionById(
    """
    The globally unique \`ID\` to be used in selecting a single \`RecurringTransaction\`.
    """
    id: ID!
  ): RecurringTransaction

  """Reads a single \`ReconciliationQueue\` using its globally unique \`ID\`."""
  reconciliationQueueById(
    """
    The globally unique \`ID\` to be used in selecting a single \`ReconciliationQueue\`.
    """
    id: ID!
  ): ReconciliationQueue

  """Reads a single \`Account\` using its globally unique \`ID\`."""
  accountById(
    """The globally unique \`ID\` to be used in selecting a single \`Account\`."""
    id: ID!
  ): Account

  """Reads a single \`ConnectedAccount\` using its globally unique \`ID\`."""
  connectedAccountById(
    """
    The globally unique \`ID\` to be used in selecting a single \`ConnectedAccount\`.
    """
    id: ID!
  ): ConnectedAccount

  """Reads and enables pagination through a set of \`_DrizzleMigration\`."""
  _drizzleMigrations(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: _DrizzleMigrationCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: _DrizzleMigrationFilter

    """The method to use when ordering \`_DrizzleMigration\`."""
    orderBy: [_DrizzleMigrationOrderBy!] = [PRIMARY_KEY_ASC]
  ): _DrizzleMigrationConnection

  """Reads and enables pagination through a set of \`AccountMapping\`."""
  accountMappings(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: AccountMappingCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: AccountMappingFilter

    """The method to use when ordering \`AccountMapping\`."""
    orderBy: [AccountMappingOrderBy!] = [PRIMARY_KEY_ASC]
  ): AccountMappingConnection

  """Reads and enables pagination through a set of \`JournalLine\`."""
  journalLines(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: JournalLineCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: JournalLineFilter

    """The method to use when ordering \`JournalLine\`."""
    orderBy: [JournalLineOrderBy!] = [PRIMARY_KEY_ASC]
  ): JournalLineConnection

  """Reads and enables pagination through a set of \`SavingsGoal\`."""
  savingsGoals(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: SavingsGoalCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: SavingsGoalFilter

    """The method to use when ordering \`SavingsGoal\`."""
    orderBy: [SavingsGoalOrderBy!] = [PRIMARY_KEY_ASC]
  ): SavingsGoalConnection

  """Reads and enables pagination through a set of \`NetWorthSnapshot\`."""
  netWorthSnapshots(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: NetWorthSnapshotCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: NetWorthSnapshotFilter

    """The method to use when ordering \`NetWorthSnapshot\`."""
    orderBy: [NetWorthSnapshotOrderBy!] = [PRIMARY_KEY_ASC]
  ): NetWorthSnapshotConnection

  """Reads and enables pagination through a set of \`AccountingPeriod\`."""
  accountingPeriods(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: AccountingPeriodCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: AccountingPeriodFilter

    """The method to use when ordering \`AccountingPeriod\`."""
    orderBy: [AccountingPeriodOrderBy!] = [PRIMARY_KEY_ASC]
  ): AccountingPeriodConnection

  """Reads and enables pagination through a set of \`CryptoLot\`."""
  cryptoLots(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: CryptoLotCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: CryptoLotFilter

    """The method to use when ordering \`CryptoLot\`."""
    orderBy: [CryptoLotOrderBy!] = [PRIMARY_KEY_ASC]
  ): CryptoLotConnection

  """Reads and enables pagination through a set of \`Book\`."""
  books(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: BookCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: BookFilter

    """The method to use when ordering \`Book\`."""
    orderBy: [BookOrderBy!] = [PRIMARY_KEY_ASC]
  ): BookConnection

  """Reads and enables pagination through a set of \`Budget\`."""
  budgets(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: BudgetCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: BudgetFilter

    """The method to use when ordering \`Budget\`."""
    orderBy: [BudgetOrderBy!] = [PRIMARY_KEY_ASC]
  ): BudgetConnection

  """Reads and enables pagination through a set of \`CryptoAsset\`."""
  cryptoAssets(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: CryptoAssetCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: CryptoAssetFilter

    """The method to use when ordering \`CryptoAsset\`."""
    orderBy: [CryptoAssetOrderBy!] = [PRIMARY_KEY_ASC]
  ): CryptoAssetConnection

  """Reads and enables pagination through a set of \`CategorizationRule\`."""
  categorizationRules(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: CategorizationRuleCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: CategorizationRuleFilter

    """The method to use when ordering \`CategorizationRule\`."""
    orderBy: [CategorizationRuleOrderBy!] = [PRIMARY_KEY_ASC]
  ): CategorizationRuleConnection

  """Reads and enables pagination through a set of \`JournalEntry\`."""
  journalEntries(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: JournalEntryCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: JournalEntryFilter

    """The method to use when ordering \`JournalEntry\`."""
    orderBy: [JournalEntryOrderBy!] = [PRIMARY_KEY_ASC]
  ): JournalEntryConnection

  """Reads and enables pagination through a set of \`FixedAsset\`."""
  fixedAssets(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: FixedAssetCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: FixedAssetFilter

    """The method to use when ordering \`FixedAsset\`."""
    orderBy: [FixedAssetOrderBy!] = [PRIMARY_KEY_ASC]
  ): FixedAssetConnection

  """Reads and enables pagination through a set of \`RecurringTransaction\`."""
  recurringTransactions(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: RecurringTransactionCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: RecurringTransactionFilter

    """The method to use when ordering \`RecurringTransaction\`."""
    orderBy: [RecurringTransactionOrderBy!] = [PRIMARY_KEY_ASC]
  ): RecurringTransactionConnection

  """Reads and enables pagination through a set of \`ReconciliationQueue\`."""
  reconciliationQueues(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: ReconciliationQueueCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: ReconciliationQueueFilter

    """The method to use when ordering \`ReconciliationQueue\`."""
    orderBy: [ReconciliationQueueOrderBy!] = [PRIMARY_KEY_ASC]
  ): ReconciliationQueueConnection

  """Reads and enables pagination through a set of \`Account\`."""
  accounts(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: AccountCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: AccountFilter

    """The method to use when ordering \`Account\`."""
    orderBy: [AccountOrderBy!] = [PRIMARY_KEY_ASC]
  ): AccountConnection

  """Reads and enables pagination through a set of \`ConnectedAccount\`."""
  connectedAccounts(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: ConnectedAccountCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: ConnectedAccountFilter

    """The method to use when ordering \`ConnectedAccount\`."""
    orderBy: [ConnectedAccountOrderBy!] = [PRIMARY_KEY_ASC]
  ): ConnectedAccountConnection
}

"""An object with a globally unique \`ID\`."""
interface Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
}

type _DrizzleMigration implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: Int!
  hash: String!
  createdAt: BigInt
}

"""
A signed eight-byte integer. The upper big integer values are greater than the
max value for a JavaScript number. Therefore all big integers will be output as
strings and not numbers.
"""
scalar BigInt

type AccountMapping implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  bookId: UUID!
  eventType: String!
  debitAccountId: UUID!
  creditAccountId: UUID!
  createdAt: Datetime
  updatedAt: Datetime

  """Reads a single \`Book\` that is related to this \`AccountMapping\`."""
  book: Book

  """Reads a single \`Account\` that is related to this \`AccountMapping\`."""
  creditAccount: Account

  """Reads a single \`Account\` that is related to this \`AccountMapping\`."""
  debitAccount: Account
}

"""
A universally unique identifier as defined by [RFC 4122](https://tools.ietf.org/html/rfc4122).
"""
scalar UUID

"""
A point in time as described by the [ISO
8601](https://en.wikipedia.org/wiki/ISO_8601) and, if it has a timezone, [RFC
3339](https://datatracker.ietf.org/doc/html/rfc3339) standards. Input values
that do not conform to both ISO 8601 and RFC 3339 may be coerced, which may lead
to unexpected results.
"""
scalar Datetime

type Book implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  organizationId: String!
  name: String!
  type: BookType!
  currency: String!
  fiscalYearStartMonth: Int!
  createdAt: Datetime
  updatedAt: Datetime

  """Reads and enables pagination through a set of \`Account\`."""
  accounts(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: AccountCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: AccountFilter

    """The method to use when ordering \`Account\`."""
    orderBy: [AccountOrderBy!] = [PRIMARY_KEY_ASC]
  ): AccountConnection!

  """Reads and enables pagination through a set of \`AccountMapping\`."""
  accountMappings(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: AccountMappingCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: AccountMappingFilter

    """The method to use when ordering \`AccountMapping\`."""
    orderBy: [AccountMappingOrderBy!] = [PRIMARY_KEY_ASC]
  ): AccountMappingConnection!

  """Reads and enables pagination through a set of \`Budget\`."""
  budgets(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: BudgetCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: BudgetFilter

    """The method to use when ordering \`Budget\`."""
    orderBy: [BudgetOrderBy!] = [PRIMARY_KEY_ASC]
  ): BudgetConnection!

  """Reads and enables pagination through a set of \`ConnectedAccount\`."""
  connectedAccounts(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: ConnectedAccountCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: ConnectedAccountFilter

    """The method to use when ordering \`ConnectedAccount\`."""
    orderBy: [ConnectedAccountOrderBy!] = [PRIMARY_KEY_ASC]
  ): ConnectedAccountConnection!

  """Reads and enables pagination through a set of \`CryptoAsset\`."""
  cryptoAssets(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: CryptoAssetCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: CryptoAssetFilter

    """The method to use when ordering \`CryptoAsset\`."""
    orderBy: [CryptoAssetOrderBy!] = [PRIMARY_KEY_ASC]
  ): CryptoAssetConnection!

  """Reads and enables pagination through a set of \`JournalEntry\`."""
  journalEntries(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: JournalEntryCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: JournalEntryFilter

    """The method to use when ordering \`JournalEntry\`."""
    orderBy: [JournalEntryOrderBy!] = [PRIMARY_KEY_ASC]
  ): JournalEntryConnection!

  """Reads and enables pagination through a set of \`NetWorthSnapshot\`."""
  netWorthSnapshots(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: NetWorthSnapshotCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: NetWorthSnapshotFilter

    """The method to use when ordering \`NetWorthSnapshot\`."""
    orderBy: [NetWorthSnapshotOrderBy!] = [PRIMARY_KEY_ASC]
  ): NetWorthSnapshotConnection!

  """Reads and enables pagination through a set of \`ReconciliationQueue\`."""
  reconciliationQueues(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: ReconciliationQueueCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: ReconciliationQueueFilter

    """The method to use when ordering \`ReconciliationQueue\`."""
    orderBy: [ReconciliationQueueOrderBy!] = [PRIMARY_KEY_ASC]
  ): ReconciliationQueueConnection!

  """Reads and enables pagination through a set of \`RecurringTransaction\`."""
  recurringTransactions(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: RecurringTransactionCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: RecurringTransactionFilter

    """The method to use when ordering \`RecurringTransaction\`."""
    orderBy: [RecurringTransactionOrderBy!] = [PRIMARY_KEY_ASC]
  ): RecurringTransactionConnection!

  """Reads and enables pagination through a set of \`SavingsGoal\`."""
  savingsGoals(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: SavingsGoalCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: SavingsGoalFilter

    """The method to use when ordering \`SavingsGoal\`."""
    orderBy: [SavingsGoalOrderBy!] = [PRIMARY_KEY_ASC]
  ): SavingsGoalConnection!

  """Reads and enables pagination through a set of \`AccountingPeriod\`."""
  accountingPeriods(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: AccountingPeriodCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: AccountingPeriodFilter

    """The method to use when ordering \`AccountingPeriod\`."""
    orderBy: [AccountingPeriodOrderBy!] = [PRIMARY_KEY_ASC]
  ): AccountingPeriodConnection!

  """Reads and enables pagination through a set of \`CategorizationRule\`."""
  categorizationRules(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: CategorizationRuleCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: CategorizationRuleFilter

    """The method to use when ordering \`CategorizationRule\`."""
    orderBy: [CategorizationRuleOrderBy!] = [PRIMARY_KEY_ASC]
  ): CategorizationRuleConnection!

  """Reads and enables pagination through a set of \`FixedAsset\`."""
  fixedAssets(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: FixedAssetCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: FixedAssetFilter

    """The method to use when ordering \`FixedAsset\`."""
    orderBy: [FixedAssetOrderBy!] = [PRIMARY_KEY_ASC]
  ): FixedAssetConnection!
}

enum BookType {
  business
  personal
}

"""A connection to a list of \`Account\` values."""
type AccountConnection {
  """A list of \`Account\` objects."""
  nodes: [Account]!

  """
  A list of edges which contains the \`Account\` and cursor to aid in pagination.
  """
  edges: [AccountEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """The count of *all* \`Account\` you could get from the connection."""
  totalCount: Int!
}

type Account implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  bookId: UUID!
  parentId: UUID
  name: String!
  code: String
  type: AccountType!
  subType: AccountSubType
  isPlaceholder: Boolean!
  isActive: Boolean!
  createdAt: Datetime
  updatedAt: Datetime

  """Reads a single \`Book\` that is related to this \`Account\`."""
  book: Book

  """Reads a single \`Account\` that is related to this \`Account\`."""
  parent: Account

  """Reads and enables pagination through a set of \`Account\`."""
  childAccounts(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: AccountCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: AccountFilter

    """The method to use when ordering \`Account\`."""
    orderBy: [AccountOrderBy!] = [PRIMARY_KEY_ASC]
  ): AccountConnection!

  """Reads and enables pagination through a set of \`Budget\`."""
  budgets(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: BudgetCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: BudgetFilter

    """The method to use when ordering \`Budget\`."""
    orderBy: [BudgetOrderBy!] = [PRIMARY_KEY_ASC]
  ): BudgetConnection!

  """Reads and enables pagination through a set of \`JournalLine\`."""
  journalLines(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: JournalLineCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: JournalLineFilter

    """The method to use when ordering \`JournalLine\`."""
    orderBy: [JournalLineOrderBy!] = [PRIMARY_KEY_ASC]
  ): JournalLineConnection!
}

enum AccountType {
  asset
  liability
  equity
  revenue
  expense
}

enum AccountSubType {
  cash
  bank
  accounts_receivable
  inventory
  crypto_wallet
  investment
  fixed_asset
  other_asset
  credit_card
  accounts_payable
  loan
  mortgage
  other_liability
  owners_equity
  retained_earnings
  other_equity
  sales
  service_revenue
  interest_income
  crypto_gains
  other_revenue
  cost_of_goods
  operating_expense
  payroll
  tax_expense
  crypto_losses
  other_expense
}

"""A location in a connection that can be used for resuming pagination."""
scalar Cursor

"""
A condition to be used against \`Account\` object types. All fields are tested for equality and combined with a logical ‘and.’
"""
input AccountCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`bookId\` field."""
  bookId: UUID

  """Checks for equality with the object’s \`parentId\` field."""
  parentId: UUID

  """Checks for equality with the object’s \`type\` field."""
  type: AccountType
}

"""
A filter to be used against \`Account\` object types. All fields are combined with a logical ‘and.’
"""
input AccountFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`bookId\` field."""
  bookId: UUIDFilter

  """Filter by the object’s \`parentId\` field."""
  parentId: UUIDFilter

  """Filter by the object’s \`type\` field."""
  type: AccountTypeFilter

  """Filter by the object’s \`childAccounts\` relation."""
  childAccounts: AccountToManyAccountFilter

  """Some related \`childAccounts\` exist."""
  childAccountsExist: Boolean

  """Filter by the object’s \`budgets\` relation."""
  budgets: AccountToManyBudgetFilter

  """Some related \`budgets\` exist."""
  budgetsExist: Boolean

  """Filter by the object’s \`journalLines\` relation."""
  journalLines: AccountToManyJournalLineFilter

  """Some related \`journalLines\` exist."""
  journalLinesExist: Boolean

  """Filter by the object’s \`book\` relation."""
  book: BookFilter

  """Filter by the object’s \`parent\` relation."""
  parent: AccountFilter

  """A related \`parent\` exists."""
  parentExists: Boolean

  """Checks for all expressions in this list."""
  and: [AccountFilter!]

  """Checks for any expressions in this list."""
  or: [AccountFilter!]

  """Negates the expression."""
  not: AccountFilter
}

"""
A filter to be used against UUID fields. All fields are combined with a logical ‘and.’
"""
input UUIDFilter {
  """
  Is null (if \`true\` is specified) or is not null (if \`false\` is specified).
  """
  isNull: Boolean

  """Equal to the specified value."""
  equalTo: UUID

  """Not equal to the specified value."""
  notEqualTo: UUID

  """
  Not equal to the specified value, treating null like an ordinary value.
  """
  distinctFrom: UUID

  """Equal to the specified value, treating null like an ordinary value."""
  notDistinctFrom: UUID

  """Included in the specified list."""
  in: [UUID!]

  """Not included in the specified list."""
  notIn: [UUID!]

  """Less than the specified value."""
  lessThan: UUID

  """Less than or equal to the specified value."""
  lessThanOrEqualTo: UUID

  """Greater than the specified value."""
  greaterThan: UUID

  """Greater than or equal to the specified value."""
  greaterThanOrEqualTo: UUID
}

"""
A filter to be used against AccountType fields. All fields are combined with a logical ‘and.’
"""
input AccountTypeFilter {
  """
  Is null (if \`true\` is specified) or is not null (if \`false\` is specified).
  """
  isNull: Boolean

  """Equal to the specified value."""
  equalTo: AccountType

  """Not equal to the specified value."""
  notEqualTo: AccountType

  """
  Not equal to the specified value, treating null like an ordinary value.
  """
  distinctFrom: AccountType

  """Equal to the specified value, treating null like an ordinary value."""
  notDistinctFrom: AccountType

  """Included in the specified list."""
  in: [AccountType!]

  """Not included in the specified list."""
  notIn: [AccountType!]

  """Less than the specified value."""
  lessThan: AccountType

  """Less than or equal to the specified value."""
  lessThanOrEqualTo: AccountType

  """Greater than the specified value."""
  greaterThan: AccountType

  """Greater than or equal to the specified value."""
  greaterThanOrEqualTo: AccountType
}

"""
A filter to be used against many \`Account\` object types. All fields are combined with a logical ‘and.’
"""
input AccountToManyAccountFilter {
  """
  Every related \`Account\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: AccountFilter

  """
  Some related \`Account\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: AccountFilter

  """
  No related \`Account\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: AccountFilter
}

"""
A filter to be used against many \`Budget\` object types. All fields are combined with a logical ‘and.’
"""
input AccountToManyBudgetFilter {
  """
  Every related \`Budget\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: BudgetFilter

  """
  Some related \`Budget\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: BudgetFilter

  """
  No related \`Budget\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: BudgetFilter
}

"""
A filter to be used against \`Budget\` object types. All fields are combined with a logical ‘and.’
"""
input BudgetFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`bookId\` field."""
  bookId: UUIDFilter

  """Filter by the object’s \`accountId\` field."""
  accountId: UUIDFilter

  """Filter by the object’s \`account\` relation."""
  account: AccountFilter

  """Filter by the object’s \`book\` relation."""
  book: BookFilter

  """Checks for all expressions in this list."""
  and: [BudgetFilter!]

  """Checks for any expressions in this list."""
  or: [BudgetFilter!]

  """Negates the expression."""
  not: BudgetFilter
}

"""
A filter to be used against \`Book\` object types. All fields are combined with a logical ‘and.’
"""
input BookFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`organizationId\` field."""
  organizationId: StringFilter

  """Filter by the object’s \`accounts\` relation."""
  accounts: BookToManyAccountFilter

  """Some related \`accounts\` exist."""
  accountsExist: Boolean

  """Filter by the object’s \`accountMappings\` relation."""
  accountMappings: BookToManyAccountMappingFilter

  """Some related \`accountMappings\` exist."""
  accountMappingsExist: Boolean

  """Filter by the object’s \`budgets\` relation."""
  budgets: BookToManyBudgetFilter

  """Some related \`budgets\` exist."""
  budgetsExist: Boolean

  """Filter by the object’s \`connectedAccounts\` relation."""
  connectedAccounts: BookToManyConnectedAccountFilter

  """Some related \`connectedAccounts\` exist."""
  connectedAccountsExist: Boolean

  """Filter by the object’s \`cryptoAssets\` relation."""
  cryptoAssets: BookToManyCryptoAssetFilter

  """Some related \`cryptoAssets\` exist."""
  cryptoAssetsExist: Boolean

  """Filter by the object’s \`journalEntries\` relation."""
  journalEntries: BookToManyJournalEntryFilter

  """Some related \`journalEntries\` exist."""
  journalEntriesExist: Boolean

  """Filter by the object’s \`netWorthSnapshots\` relation."""
  netWorthSnapshots: BookToManyNetWorthSnapshotFilter

  """Some related \`netWorthSnapshots\` exist."""
  netWorthSnapshotsExist: Boolean

  """Filter by the object’s \`reconciliationQueues\` relation."""
  reconciliationQueues: BookToManyReconciliationQueueFilter

  """Some related \`reconciliationQueues\` exist."""
  reconciliationQueuesExist: Boolean

  """Filter by the object’s \`recurringTransactions\` relation."""
  recurringTransactions: BookToManyRecurringTransactionFilter

  """Some related \`recurringTransactions\` exist."""
  recurringTransactionsExist: Boolean

  """Filter by the object’s \`savingsGoals\` relation."""
  savingsGoals: BookToManySavingsGoalFilter

  """Some related \`savingsGoals\` exist."""
  savingsGoalsExist: Boolean

  """Filter by the object’s \`accountingPeriods\` relation."""
  accountingPeriods: BookToManyAccountingPeriodFilter

  """Some related \`accountingPeriods\` exist."""
  accountingPeriodsExist: Boolean

  """Filter by the object’s \`categorizationRules\` relation."""
  categorizationRules: BookToManyCategorizationRuleFilter

  """Some related \`categorizationRules\` exist."""
  categorizationRulesExist: Boolean

  """Filter by the object’s \`fixedAssets\` relation."""
  fixedAssets: BookToManyFixedAssetFilter

  """Some related \`fixedAssets\` exist."""
  fixedAssetsExist: Boolean

  """Checks for all expressions in this list."""
  and: [BookFilter!]

  """Checks for any expressions in this list."""
  or: [BookFilter!]

  """Negates the expression."""
  not: BookFilter
}

"""
A filter to be used against String fields. All fields are combined with a logical ‘and.’
"""
input StringFilter {
  """
  Is null (if \`true\` is specified) or is not null (if \`false\` is specified).
  """
  isNull: Boolean

  """Equal to the specified value."""
  equalTo: String

  """Not equal to the specified value."""
  notEqualTo: String

  """
  Not equal to the specified value, treating null like an ordinary value.
  """
  distinctFrom: String

  """Equal to the specified value, treating null like an ordinary value."""
  notDistinctFrom: String

  """Included in the specified list."""
  in: [String!]

  """Not included in the specified list."""
  notIn: [String!]

  """Less than the specified value."""
  lessThan: String

  """Less than or equal to the specified value."""
  lessThanOrEqualTo: String

  """Greater than the specified value."""
  greaterThan: String

  """Greater than or equal to the specified value."""
  greaterThanOrEqualTo: String

  """Contains the specified string (case-sensitive)."""
  includes: String

  """Does not contain the specified string (case-sensitive)."""
  notIncludes: String

  """Contains the specified string (case-insensitive)."""
  includesInsensitive: String

  """Does not contain the specified string (case-insensitive)."""
  notIncludesInsensitive: String

  """Starts with the specified string (case-sensitive)."""
  startsWith: String

  """Does not start with the specified string (case-sensitive)."""
  notStartsWith: String

  """Starts with the specified string (case-insensitive)."""
  startsWithInsensitive: String

  """Does not start with the specified string (case-insensitive)."""
  notStartsWithInsensitive: String

  """Ends with the specified string (case-sensitive)."""
  endsWith: String

  """Does not end with the specified string (case-sensitive)."""
  notEndsWith: String

  """Ends with the specified string (case-insensitive)."""
  endsWithInsensitive: String

  """Does not end with the specified string (case-insensitive)."""
  notEndsWithInsensitive: String

  """
  Matches the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.
  """
  like: String

  """
  Does not match the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.
  """
  notLike: String

  """
  Matches the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.
  """
  likeInsensitive: String

  """
  Does not match the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.
  """
  notLikeInsensitive: String

  """Equal to the specified value (case-insensitive)."""
  equalToInsensitive: String

  """Not equal to the specified value (case-insensitive)."""
  notEqualToInsensitive: String

  """
  Not equal to the specified value, treating null like an ordinary value (case-insensitive).
  """
  distinctFromInsensitive: String

  """
  Equal to the specified value, treating null like an ordinary value (case-insensitive).
  """
  notDistinctFromInsensitive: String

  """Included in the specified list (case-insensitive)."""
  inInsensitive: [String!]

  """Not included in the specified list (case-insensitive)."""
  notInInsensitive: [String!]

  """Less than the specified value (case-insensitive)."""
  lessThanInsensitive: String

  """Less than or equal to the specified value (case-insensitive)."""
  lessThanOrEqualToInsensitive: String

  """Greater than the specified value (case-insensitive)."""
  greaterThanInsensitive: String

  """Greater than or equal to the specified value (case-insensitive)."""
  greaterThanOrEqualToInsensitive: String
}

"""
A filter to be used against many \`Account\` object types. All fields are combined with a logical ‘and.’
"""
input BookToManyAccountFilter {
  """
  Every related \`Account\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: AccountFilter

  """
  Some related \`Account\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: AccountFilter

  """
  No related \`Account\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: AccountFilter
}

"""
A filter to be used against many \`AccountMapping\` object types. All fields are combined with a logical ‘and.’
"""
input BookToManyAccountMappingFilter {
  """
  Every related \`AccountMapping\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: AccountMappingFilter

  """
  Some related \`AccountMapping\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: AccountMappingFilter

  """
  No related \`AccountMapping\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: AccountMappingFilter
}

"""
A filter to be used against \`AccountMapping\` object types. All fields are combined with a logical ‘and.’
"""
input AccountMappingFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`bookId\` field."""
  bookId: UUIDFilter

  """Filter by the object’s \`eventType\` field."""
  eventType: StringFilter

  """Filter by the object’s \`book\` relation."""
  book: BookFilter

  """Filter by the object’s \`creditAccount\` relation."""
  creditAccount: AccountFilter

  """Filter by the object’s \`debitAccount\` relation."""
  debitAccount: AccountFilter

  """Checks for all expressions in this list."""
  and: [AccountMappingFilter!]

  """Checks for any expressions in this list."""
  or: [AccountMappingFilter!]

  """Negates the expression."""
  not: AccountMappingFilter
}

"""
A filter to be used against many \`Budget\` object types. All fields are combined with a logical ‘and.’
"""
input BookToManyBudgetFilter {
  """
  Every related \`Budget\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: BudgetFilter

  """
  Some related \`Budget\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: BudgetFilter

  """
  No related \`Budget\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: BudgetFilter
}

"""
A filter to be used against many \`ConnectedAccount\` object types. All fields are combined with a logical ‘and.’
"""
input BookToManyConnectedAccountFilter {
  """
  Every related \`ConnectedAccount\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: ConnectedAccountFilter

  """
  Some related \`ConnectedAccount\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: ConnectedAccountFilter

  """
  No related \`ConnectedAccount\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: ConnectedAccountFilter
}

"""
A filter to be used against \`ConnectedAccount\` object types. All fields are combined with a logical ‘and.’
"""
input ConnectedAccountFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`bookId\` field."""
  bookId: UUIDFilter

  """Filter by the object’s \`provider\` field."""
  provider: ConnectedAccountProviderFilter

  """Filter by the object’s \`account\` relation."""
  account: AccountFilter

  """A related \`account\` exists."""
  accountExists: Boolean

  """Filter by the object’s \`book\` relation."""
  book: BookFilter

  """Checks for all expressions in this list."""
  and: [ConnectedAccountFilter!]

  """Checks for any expressions in this list."""
  or: [ConnectedAccountFilter!]

  """Negates the expression."""
  not: ConnectedAccountFilter
}

"""
A filter to be used against ConnectedAccountProvider fields. All fields are combined with a logical ‘and.’
"""
input ConnectedAccountProviderFilter {
  """
  Is null (if \`true\` is specified) or is not null (if \`false\` is specified).
  """
  isNull: Boolean

  """Equal to the specified value."""
  equalTo: ConnectedAccountProvider

  """Not equal to the specified value."""
  notEqualTo: ConnectedAccountProvider

  """
  Not equal to the specified value, treating null like an ordinary value.
  """
  distinctFrom: ConnectedAccountProvider

  """Equal to the specified value, treating null like an ordinary value."""
  notDistinctFrom: ConnectedAccountProvider

  """Included in the specified list."""
  in: [ConnectedAccountProvider!]

  """Not included in the specified list."""
  notIn: [ConnectedAccountProvider!]

  """Less than the specified value."""
  lessThan: ConnectedAccountProvider

  """Less than or equal to the specified value."""
  lessThanOrEqualTo: ConnectedAccountProvider

  """Greater than the specified value."""
  greaterThan: ConnectedAccountProvider

  """Greater than or equal to the specified value."""
  greaterThanOrEqualTo: ConnectedAccountProvider
}

enum ConnectedAccountProvider {
  plaid
  mx
  wallet_connect
  exchange_api
  manual
}

"""
A filter to be used against many \`CryptoAsset\` object types. All fields are combined with a logical ‘and.’
"""
input BookToManyCryptoAssetFilter {
  """
  Every related \`CryptoAsset\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: CryptoAssetFilter

  """
  Some related \`CryptoAsset\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: CryptoAssetFilter

  """
  No related \`CryptoAsset\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: CryptoAssetFilter
}

"""
A filter to be used against \`CryptoAsset\` object types. All fields are combined with a logical ‘and.’
"""
input CryptoAssetFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`bookId\` field."""
  bookId: UUIDFilter

  """Filter by the object’s \`symbol\` field."""
  symbol: StringFilter

  """Filter by the object’s \`cryptoLots\` relation."""
  cryptoLots: CryptoAssetToManyCryptoLotFilter

  """Some related \`cryptoLots\` exist."""
  cryptoLotsExist: Boolean

  """Filter by the object’s \`book\` relation."""
  book: BookFilter

  """Checks for all expressions in this list."""
  and: [CryptoAssetFilter!]

  """Checks for any expressions in this list."""
  or: [CryptoAssetFilter!]

  """Negates the expression."""
  not: CryptoAssetFilter
}

"""
A filter to be used against many \`CryptoLot\` object types. All fields are combined with a logical ‘and.’
"""
input CryptoAssetToManyCryptoLotFilter {
  """
  Every related \`CryptoLot\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: CryptoLotFilter

  """
  Some related \`CryptoLot\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: CryptoLotFilter

  """
  No related \`CryptoLot\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: CryptoLotFilter
}

"""
A filter to be used against \`CryptoLot\` object types. All fields are combined with a logical ‘and.’
"""
input CryptoLotFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`cryptoAssetId\` field."""
  cryptoAssetId: UUIDFilter

  """Filter by the object’s \`cryptoAsset\` relation."""
  cryptoAsset: CryptoAssetFilter

  """Filter by the object’s \`journalEntry\` relation."""
  journalEntry: JournalEntryFilter

  """A related \`journalEntry\` exists."""
  journalEntryExists: Boolean

  """Checks for all expressions in this list."""
  and: [CryptoLotFilter!]

  """Checks for any expressions in this list."""
  or: [CryptoLotFilter!]

  """Negates the expression."""
  not: CryptoLotFilter
}

"""
A filter to be used against \`JournalEntry\` object types. All fields are combined with a logical ‘and.’
"""
input JournalEntryFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`bookId\` field."""
  bookId: UUIDFilter

  """Filter by the object’s \`date\` field."""
  date: DatetimeFilter

  """Filter by the object’s \`source\` field."""
  source: JournalEntrySourceFilter

  """Filter by the object’s \`sourceReferenceId\` field."""
  sourceReferenceId: StringFilter

  """Filter by the object’s \`journalLines\` relation."""
  journalLines: JournalEntryToManyJournalLineFilter

  """Some related \`journalLines\` exist."""
  journalLinesExist: Boolean

  """Filter by the object’s \`book\` relation."""
  book: BookFilter

  """Checks for all expressions in this list."""
  and: [JournalEntryFilter!]

  """Checks for any expressions in this list."""
  or: [JournalEntryFilter!]

  """Negates the expression."""
  not: JournalEntryFilter
}

"""
A filter to be used against Datetime fields. All fields are combined with a logical ‘and.’
"""
input DatetimeFilter {
  """
  Is null (if \`true\` is specified) or is not null (if \`false\` is specified).
  """
  isNull: Boolean

  """Equal to the specified value."""
  equalTo: Datetime

  """Not equal to the specified value."""
  notEqualTo: Datetime

  """
  Not equal to the specified value, treating null like an ordinary value.
  """
  distinctFrom: Datetime

  """Equal to the specified value, treating null like an ordinary value."""
  notDistinctFrom: Datetime

  """Included in the specified list."""
  in: [Datetime!]

  """Not included in the specified list."""
  notIn: [Datetime!]

  """Less than the specified value."""
  lessThan: Datetime

  """Less than or equal to the specified value."""
  lessThanOrEqualTo: Datetime

  """Greater than the specified value."""
  greaterThan: Datetime

  """Greater than or equal to the specified value."""
  greaterThanOrEqualTo: Datetime
}

"""
A filter to be used against JournalEntrySource fields. All fields are combined with a logical ‘and.’
"""
input JournalEntrySourceFilter {
  """
  Is null (if \`true\` is specified) or is not null (if \`false\` is specified).
  """
  isNull: Boolean

  """Equal to the specified value."""
  equalTo: JournalEntrySource

  """Not equal to the specified value."""
  notEqualTo: JournalEntrySource

  """
  Not equal to the specified value, treating null like an ordinary value.
  """
  distinctFrom: JournalEntrySource

  """Equal to the specified value, treating null like an ordinary value."""
  notDistinctFrom: JournalEntrySource

  """Included in the specified list."""
  in: [JournalEntrySource!]

  """Not included in the specified list."""
  notIn: [JournalEntrySource!]

  """Less than the specified value."""
  lessThan: JournalEntrySource

  """Less than or equal to the specified value."""
  lessThanOrEqualTo: JournalEntrySource

  """Greater than the specified value."""
  greaterThan: JournalEntrySource

  """Greater than or equal to the specified value."""
  greaterThanOrEqualTo: JournalEntrySource
}

enum JournalEntrySource {
  manual
  mantle_sync
  plaid_import
  crypto_sync
  recurring
}

"""
A filter to be used against many \`JournalLine\` object types. All fields are combined with a logical ‘and.’
"""
input JournalEntryToManyJournalLineFilter {
  """
  Every related \`JournalLine\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: JournalLineFilter

  """
  Some related \`JournalLine\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: JournalLineFilter

  """
  No related \`JournalLine\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: JournalLineFilter
}

"""
A filter to be used against \`JournalLine\` object types. All fields are combined with a logical ‘and.’
"""
input JournalLineFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`journalEntryId\` field."""
  journalEntryId: UUIDFilter

  """Filter by the object’s \`accountId\` field."""
  accountId: UUIDFilter

  """Filter by the object’s \`account\` relation."""
  account: AccountFilter

  """Filter by the object’s \`journalEntry\` relation."""
  journalEntry: JournalEntryFilter

  """Checks for all expressions in this list."""
  and: [JournalLineFilter!]

  """Checks for any expressions in this list."""
  or: [JournalLineFilter!]

  """Negates the expression."""
  not: JournalLineFilter
}

"""
A filter to be used against many \`JournalEntry\` object types. All fields are combined with a logical ‘and.’
"""
input BookToManyJournalEntryFilter {
  """
  Every related \`JournalEntry\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: JournalEntryFilter

  """
  Some related \`JournalEntry\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: JournalEntryFilter

  """
  No related \`JournalEntry\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: JournalEntryFilter
}

"""
A filter to be used against many \`NetWorthSnapshot\` object types. All fields are combined with a logical ‘and.’
"""
input BookToManyNetWorthSnapshotFilter {
  """
  Every related \`NetWorthSnapshot\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: NetWorthSnapshotFilter

  """
  Some related \`NetWorthSnapshot\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: NetWorthSnapshotFilter

  """
  No related \`NetWorthSnapshot\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: NetWorthSnapshotFilter
}

"""
A filter to be used against \`NetWorthSnapshot\` object types. All fields are combined with a logical ‘and.’
"""
input NetWorthSnapshotFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`bookId\` field."""
  bookId: UUIDFilter

  """Filter by the object’s \`date\` field."""
  date: DatetimeFilter

  """Filter by the object’s \`book\` relation."""
  book: BookFilter

  """Checks for all expressions in this list."""
  and: [NetWorthSnapshotFilter!]

  """Checks for any expressions in this list."""
  or: [NetWorthSnapshotFilter!]

  """Negates the expression."""
  not: NetWorthSnapshotFilter
}

"""
A filter to be used against many \`ReconciliationQueue\` object types. All fields are combined with a logical ‘and.’
"""
input BookToManyReconciliationQueueFilter {
  """
  Every related \`ReconciliationQueue\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: ReconciliationQueueFilter

  """
  Some related \`ReconciliationQueue\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: ReconciliationQueueFilter

  """
  No related \`ReconciliationQueue\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: ReconciliationQueueFilter
}

"""
A filter to be used against \`ReconciliationQueue\` object types. All fields are combined with a logical ‘and.’
"""
input ReconciliationQueueFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`bookId\` field."""
  bookId: UUIDFilter

  """Filter by the object’s \`status\` field."""
  status: ReconciliationStatusFilter

  """Filter by the object’s \`book\` relation."""
  book: BookFilter

  """Filter by the object’s \`journalEntry\` relation."""
  journalEntry: JournalEntryFilter

  """Filter by the object’s \`suggestedCreditAccount\` relation."""
  suggestedCreditAccount: AccountFilter

  """A related \`suggestedCreditAccount\` exists."""
  suggestedCreditAccountExists: Boolean

  """Filter by the object’s \`suggestedDebitAccount\` relation."""
  suggestedDebitAccount: AccountFilter

  """A related \`suggestedDebitAccount\` exists."""
  suggestedDebitAccountExists: Boolean

  """Checks for all expressions in this list."""
  and: [ReconciliationQueueFilter!]

  """Checks for any expressions in this list."""
  or: [ReconciliationQueueFilter!]

  """Negates the expression."""
  not: ReconciliationQueueFilter
}

"""
A filter to be used against ReconciliationStatus fields. All fields are combined with a logical ‘and.’
"""
input ReconciliationStatusFilter {
  """
  Is null (if \`true\` is specified) or is not null (if \`false\` is specified).
  """
  isNull: Boolean

  """Equal to the specified value."""
  equalTo: ReconciliationStatus

  """Not equal to the specified value."""
  notEqualTo: ReconciliationStatus

  """
  Not equal to the specified value, treating null like an ordinary value.
  """
  distinctFrom: ReconciliationStatus

  """Equal to the specified value, treating null like an ordinary value."""
  notDistinctFrom: ReconciliationStatus

  """Included in the specified list."""
  in: [ReconciliationStatus!]

  """Not included in the specified list."""
  notIn: [ReconciliationStatus!]

  """Less than the specified value."""
  lessThan: ReconciliationStatus

  """Less than or equal to the specified value."""
  lessThanOrEqualTo: ReconciliationStatus

  """Greater than the specified value."""
  greaterThan: ReconciliationStatus

  """Greater than or equal to the specified value."""
  greaterThanOrEqualTo: ReconciliationStatus
}

enum ReconciliationStatus {
  pending_review
  approved
  adjusted
  rejected
}

"""
A filter to be used against many \`RecurringTransaction\` object types. All fields are combined with a logical ‘and.’
"""
input BookToManyRecurringTransactionFilter {
  """
  Every related \`RecurringTransaction\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: RecurringTransactionFilter

  """
  Some related \`RecurringTransaction\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: RecurringTransactionFilter

  """
  No related \`RecurringTransaction\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: RecurringTransactionFilter
}

"""
A filter to be used against \`RecurringTransaction\` object types. All fields are combined with a logical ‘and.’
"""
input RecurringTransactionFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`bookId\` field."""
  bookId: UUIDFilter

  """Filter by the object’s \`account\` relation."""
  account: AccountFilter

  """Filter by the object’s \`book\` relation."""
  book: BookFilter

  """Filter by the object’s \`counterAccount\` relation."""
  counterAccount: AccountFilter

  """A related \`counterAccount\` exists."""
  counterAccountExists: Boolean

  """Checks for all expressions in this list."""
  and: [RecurringTransactionFilter!]

  """Checks for any expressions in this list."""
  or: [RecurringTransactionFilter!]

  """Negates the expression."""
  not: RecurringTransactionFilter
}

"""
A filter to be used against many \`SavingsGoal\` object types. All fields are combined with a logical ‘and.’
"""
input BookToManySavingsGoalFilter {
  """
  Every related \`SavingsGoal\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: SavingsGoalFilter

  """
  Some related \`SavingsGoal\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: SavingsGoalFilter

  """
  No related \`SavingsGoal\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: SavingsGoalFilter
}

"""
A filter to be used against \`SavingsGoal\` object types. All fields are combined with a logical ‘and.’
"""
input SavingsGoalFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`bookId\` field."""
  bookId: UUIDFilter

  """Filter by the object’s \`account\` relation."""
  account: AccountFilter

  """Filter by the object’s \`book\` relation."""
  book: BookFilter

  """Checks for all expressions in this list."""
  and: [SavingsGoalFilter!]

  """Checks for any expressions in this list."""
  or: [SavingsGoalFilter!]

  """Negates the expression."""
  not: SavingsGoalFilter
}

"""
A filter to be used against many \`AccountingPeriod\` object types. All fields are combined with a logical ‘and.’
"""
input BookToManyAccountingPeriodFilter {
  """
  Every related \`AccountingPeriod\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: AccountingPeriodFilter

  """
  Some related \`AccountingPeriod\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: AccountingPeriodFilter

  """
  No related \`AccountingPeriod\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: AccountingPeriodFilter
}

"""
A filter to be used against \`AccountingPeriod\` object types. All fields are combined with a logical ‘and.’
"""
input AccountingPeriodFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`bookId\` field."""
  bookId: UUIDFilter

  """Filter by the object’s \`year\` field."""
  year: IntFilter

  """Filter by the object’s \`month\` field."""
  month: IntFilter

  """Filter by the object’s \`status\` field."""
  status: StringFilter

  """Filter by the object’s \`book\` relation."""
  book: BookFilter

  """Checks for all expressions in this list."""
  and: [AccountingPeriodFilter!]

  """Checks for any expressions in this list."""
  or: [AccountingPeriodFilter!]

  """Negates the expression."""
  not: AccountingPeriodFilter
}

"""
A filter to be used against Int fields. All fields are combined with a logical ‘and.’
"""
input IntFilter {
  """
  Is null (if \`true\` is specified) or is not null (if \`false\` is specified).
  """
  isNull: Boolean

  """Equal to the specified value."""
  equalTo: Int

  """Not equal to the specified value."""
  notEqualTo: Int

  """
  Not equal to the specified value, treating null like an ordinary value.
  """
  distinctFrom: Int

  """Equal to the specified value, treating null like an ordinary value."""
  notDistinctFrom: Int

  """Included in the specified list."""
  in: [Int!]

  """Not included in the specified list."""
  notIn: [Int!]

  """Less than the specified value."""
  lessThan: Int

  """Less than or equal to the specified value."""
  lessThanOrEqualTo: Int

  """Greater than the specified value."""
  greaterThan: Int

  """Greater than or equal to the specified value."""
  greaterThanOrEqualTo: Int
}

"""
A filter to be used against many \`CategorizationRule\` object types. All fields are combined with a logical ‘and.’
"""
input BookToManyCategorizationRuleFilter {
  """
  Every related \`CategorizationRule\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: CategorizationRuleFilter

  """
  Some related \`CategorizationRule\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: CategorizationRuleFilter

  """
  No related \`CategorizationRule\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: CategorizationRuleFilter
}

"""
A filter to be used against \`CategorizationRule\` object types. All fields are combined with a logical ‘and.’
"""
input CategorizationRuleFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`bookId\` field."""
  bookId: UUIDFilter

  """Filter by the object’s \`matchField\` field."""
  matchField: StringFilter

  """Filter by the object’s \`book\` relation."""
  book: BookFilter

  """Filter by the object’s \`creditAccount\` relation."""
  creditAccount: AccountFilter

  """Filter by the object’s \`debitAccount\` relation."""
  debitAccount: AccountFilter

  """Checks for all expressions in this list."""
  and: [CategorizationRuleFilter!]

  """Checks for any expressions in this list."""
  or: [CategorizationRuleFilter!]

  """Negates the expression."""
  not: CategorizationRuleFilter
}

"""
A filter to be used against many \`FixedAsset\` object types. All fields are combined with a logical ‘and.’
"""
input BookToManyFixedAssetFilter {
  """
  Every related \`FixedAsset\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: FixedAssetFilter

  """
  Some related \`FixedAsset\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: FixedAssetFilter

  """
  No related \`FixedAsset\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: FixedAssetFilter
}

"""
A filter to be used against \`FixedAsset\` object types. All fields are combined with a logical ‘and.’
"""
input FixedAssetFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`bookId\` field."""
  bookId: UUIDFilter

  """Filter by the object’s \`disposedAt\` field."""
  disposedAt: StringFilter

  """Filter by the object’s \`accumulatedDepreciationAccount\` relation."""
  accumulatedDepreciationAccount: AccountFilter

  """Filter by the object’s \`assetAccount\` relation."""
  assetAccount: AccountFilter

  """Filter by the object’s \`book\` relation."""
  book: BookFilter

  """Filter by the object’s \`depreciationExpenseAccount\` relation."""
  depreciationExpenseAccount: AccountFilter

  """Checks for all expressions in this list."""
  and: [FixedAssetFilter!]

  """Checks for any expressions in this list."""
  or: [FixedAssetFilter!]

  """Negates the expression."""
  not: FixedAssetFilter
}

"""
A filter to be used against many \`JournalLine\` object types. All fields are combined with a logical ‘and.’
"""
input AccountToManyJournalLineFilter {
  """
  Every related \`JournalLine\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: JournalLineFilter

  """
  Some related \`JournalLine\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: JournalLineFilter

  """
  No related \`JournalLine\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: JournalLineFilter
}

"""Methods to use when ordering \`Account\`."""
enum AccountOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  BOOK_ID_ASC
  BOOK_ID_DESC
  PARENT_ID_ASC
  PARENT_ID_DESC
}

"""A connection to a list of \`Budget\` values."""
type BudgetConnection {
  """A list of \`Budget\` objects."""
  nodes: [Budget]!

  """
  A list of edges which contains the \`Budget\` and cursor to aid in pagination.
  """
  edges: [BudgetEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """The count of *all* \`Budget\` you could get from the connection."""
  totalCount: Int!
}

type Budget implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  bookId: UUID!
  accountId: UUID!
  amount: BigFloat!
  period: BudgetPeriod!
  rollover: Boolean!
  createdAt: Datetime
  updatedAt: Datetime

  """Reads a single \`Account\` that is related to this \`Budget\`."""
  account: Account

  """Reads a single \`Book\` that is related to this \`Budget\`."""
  book: Book
}

"""
A floating point number that requires more precision than IEEE 754 binary 64
"""
scalar BigFloat

enum BudgetPeriod {
  monthly
  quarterly
  yearly
}

"""A \`Budget\` edge in the connection."""
type BudgetEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`Budget\` at the end of the edge."""
  node: Budget
}

"""Information about pagination in a connection."""
type PageInfo {
  """When paginating forwards, are there more items?"""
  hasNextPage: Boolean!

  """When paginating backwards, are there more items?"""
  hasPreviousPage: Boolean!

  """When paginating backwards, the cursor to continue."""
  startCursor: Cursor

  """When paginating forwards, the cursor to continue."""
  endCursor: Cursor
}

"""
A condition to be used against \`Budget\` object types. All fields are tested for equality and combined with a logical ‘and.’
"""
input BudgetCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`bookId\` field."""
  bookId: UUID

  """Checks for equality with the object’s \`accountId\` field."""
  accountId: UUID
}

"""Methods to use when ordering \`Budget\`."""
enum BudgetOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  BOOK_ID_ASC
  BOOK_ID_DESC
  ACCOUNT_ID_ASC
  ACCOUNT_ID_DESC
}

"""A connection to a list of \`JournalLine\` values."""
type JournalLineConnection {
  """A list of \`JournalLine\` objects."""
  nodes: [JournalLine]!

  """
  A list of edges which contains the \`JournalLine\` and cursor to aid in pagination.
  """
  edges: [JournalLineEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """The count of *all* \`JournalLine\` you could get from the connection."""
  totalCount: Int!
}

type JournalLine implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  journalEntryId: UUID!
  accountId: UUID!
  debit: BigFloat!
  credit: BigFloat!
  memo: String

  """Reads a single \`Account\` that is related to this \`JournalLine\`."""
  account: Account

  """Reads a single \`JournalEntry\` that is related to this \`JournalLine\`."""
  journalEntry: JournalEntry
}

type JournalEntry implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  bookId: UUID!
  date: Datetime!
  memo: String
  source: JournalEntrySource!
  sourceReferenceId: String
  isReviewed: Boolean!
  isReconciled: Boolean!
  createdAt: Datetime
  updatedAt: Datetime

  """Reads a single \`Book\` that is related to this \`JournalEntry\`."""
  book: Book

  """Reads and enables pagination through a set of \`JournalLine\`."""
  journalLines(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: JournalLineCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: JournalLineFilter

    """The method to use when ordering \`JournalLine\`."""
    orderBy: [JournalLineOrderBy!] = [PRIMARY_KEY_ASC]
  ): JournalLineConnection!
}

"""
A condition to be used against \`JournalLine\` object types. All fields are tested
for equality and combined with a logical ‘and.’
"""
input JournalLineCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`journalEntryId\` field."""
  journalEntryId: UUID

  """Checks for equality with the object’s \`accountId\` field."""
  accountId: UUID
}

"""Methods to use when ordering \`JournalLine\`."""
enum JournalLineOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  JOURNAL_ENTRY_ID_ASC
  JOURNAL_ENTRY_ID_DESC
  ACCOUNT_ID_ASC
  ACCOUNT_ID_DESC
}

"""A \`JournalLine\` edge in the connection."""
type JournalLineEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`JournalLine\` at the end of the edge."""
  node: JournalLine
}

"""A \`Account\` edge in the connection."""
type AccountEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`Account\` at the end of the edge."""
  node: Account
}

"""A connection to a list of \`AccountMapping\` values."""
type AccountMappingConnection {
  """A list of \`AccountMapping\` objects."""
  nodes: [AccountMapping]!

  """
  A list of edges which contains the \`AccountMapping\` and cursor to aid in pagination.
  """
  edges: [AccountMappingEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """The count of *all* \`AccountMapping\` you could get from the connection."""
  totalCount: Int!
}

"""A \`AccountMapping\` edge in the connection."""
type AccountMappingEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`AccountMapping\` at the end of the edge."""
  node: AccountMapping
}

"""
A condition to be used against \`AccountMapping\` object types. All fields are
tested for equality and combined with a logical ‘and.’
"""
input AccountMappingCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`bookId\` field."""
  bookId: UUID

  """Checks for equality with the object’s \`eventType\` field."""
  eventType: String
}

"""Methods to use when ordering \`AccountMapping\`."""
enum AccountMappingOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  BOOK_ID_ASC
  BOOK_ID_DESC
  EVENT_TYPE_ASC
  EVENT_TYPE_DESC
}

"""A connection to a list of \`ConnectedAccount\` values."""
type ConnectedAccountConnection {
  """A list of \`ConnectedAccount\` objects."""
  nodes: [ConnectedAccount]!

  """
  A list of edges which contains the \`ConnectedAccount\` and cursor to aid in pagination.
  """
  edges: [ConnectedAccountEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """
  The count of *all* \`ConnectedAccount\` you could get from the connection.
  """
  totalCount: Int!
}

type ConnectedAccount implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  bookId: UUID!
  provider: ConnectedAccountProvider!
  providerAccountId: String
  accountId: UUID
  institutionName: String
  mask: String
  status: ConnectedAccountStatus!
  accessToken: String
  lastSyncedAt: Datetime
  createdAt: Datetime
  syncCursor: String

  """Reads a single \`Account\` that is related to this \`ConnectedAccount\`."""
  account: Account

  """Reads a single \`Book\` that is related to this \`ConnectedAccount\`."""
  book: Book
}

enum ConnectedAccountStatus {
  active
  disconnected
  error
}

"""A \`ConnectedAccount\` edge in the connection."""
type ConnectedAccountEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`ConnectedAccount\` at the end of the edge."""
  node: ConnectedAccount
}

"""
A condition to be used against \`ConnectedAccount\` object types. All fields are
tested for equality and combined with a logical ‘and.’
"""
input ConnectedAccountCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`bookId\` field."""
  bookId: UUID

  """Checks for equality with the object’s \`provider\` field."""
  provider: ConnectedAccountProvider
}

"""Methods to use when ordering \`ConnectedAccount\`."""
enum ConnectedAccountOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  BOOK_ID_ASC
  BOOK_ID_DESC
}

"""A connection to a list of \`CryptoAsset\` values."""
type CryptoAssetConnection {
  """A list of \`CryptoAsset\` objects."""
  nodes: [CryptoAsset]!

  """
  A list of edges which contains the \`CryptoAsset\` and cursor to aid in pagination.
  """
  edges: [CryptoAssetEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """The count of *all* \`CryptoAsset\` you could get from the connection."""
  totalCount: Int!
}

type CryptoAsset implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  bookId: UUID!
  symbol: String!
  name: String!
  walletAddress: String
  network: String
  balance: BigFloat!
  costBasisMethod: CostBasisMethod!
  lastSyncedAt: Datetime
  createdAt: Datetime
  updatedAt: Datetime

  """Reads a single \`Book\` that is related to this \`CryptoAsset\`."""
  book: Book

  """Reads and enables pagination through a set of \`CryptoLot\`."""
  cryptoLots(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: CryptoLotCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: CryptoLotFilter

    """The method to use when ordering \`CryptoLot\`."""
    orderBy: [CryptoLotOrderBy!] = [PRIMARY_KEY_ASC]
  ): CryptoLotConnection!
}

enum CostBasisMethod {
  fifo
  lifo
  hifo
  acb
}

"""A connection to a list of \`CryptoLot\` values."""
type CryptoLotConnection {
  """A list of \`CryptoLot\` objects."""
  nodes: [CryptoLot]!

  """
  A list of edges which contains the \`CryptoLot\` and cursor to aid in pagination.
  """
  edges: [CryptoLotEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """The count of *all* \`CryptoLot\` you could get from the connection."""
  totalCount: Int!
}

type CryptoLot implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  cryptoAssetId: UUID!
  acquiredAt: Datetime!
  quantity: BigFloat!
  costPerUnit: BigFloat!
  remainingQuantity: BigFloat!
  disposedAt: Datetime
  proceedsPerUnit: BigFloat
  journalEntryId: UUID
  createdAt: Datetime

  """Reads a single \`CryptoAsset\` that is related to this \`CryptoLot\`."""
  cryptoAsset: CryptoAsset

  """Reads a single \`JournalEntry\` that is related to this \`CryptoLot\`."""
  journalEntry: JournalEntry
}

"""A \`CryptoLot\` edge in the connection."""
type CryptoLotEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`CryptoLot\` at the end of the edge."""
  node: CryptoLot
}

"""
A condition to be used against \`CryptoLot\` object types. All fields are tested
for equality and combined with a logical ‘and.’
"""
input CryptoLotCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`cryptoAssetId\` field."""
  cryptoAssetId: UUID
}

"""Methods to use when ordering \`CryptoLot\`."""
enum CryptoLotOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  CRYPTO_ASSET_ID_ASC
  CRYPTO_ASSET_ID_DESC
}

"""A \`CryptoAsset\` edge in the connection."""
type CryptoAssetEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`CryptoAsset\` at the end of the edge."""
  node: CryptoAsset
}

"""
A condition to be used against \`CryptoAsset\` object types. All fields are tested
for equality and combined with a logical ‘and.’
"""
input CryptoAssetCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`bookId\` field."""
  bookId: UUID

  """Checks for equality with the object’s \`symbol\` field."""
  symbol: String
}

"""Methods to use when ordering \`CryptoAsset\`."""
enum CryptoAssetOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  BOOK_ID_ASC
  BOOK_ID_DESC
  SYMBOL_ASC
  SYMBOL_DESC
}

"""A connection to a list of \`JournalEntry\` values."""
type JournalEntryConnection {
  """A list of \`JournalEntry\` objects."""
  nodes: [JournalEntry]!

  """
  A list of edges which contains the \`JournalEntry\` and cursor to aid in pagination.
  """
  edges: [JournalEntryEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """The count of *all* \`JournalEntry\` you could get from the connection."""
  totalCount: Int!
}

"""A \`JournalEntry\` edge in the connection."""
type JournalEntryEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`JournalEntry\` at the end of the edge."""
  node: JournalEntry
}

"""
A condition to be used against \`JournalEntry\` object types. All fields are
tested for equality and combined with a logical ‘and.’
"""
input JournalEntryCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`bookId\` field."""
  bookId: UUID

  """Checks for equality with the object’s \`date\` field."""
  date: Datetime

  """Checks for equality with the object’s \`source\` field."""
  source: JournalEntrySource

  """Checks for equality with the object’s \`sourceReferenceId\` field."""
  sourceReferenceId: String
}

"""Methods to use when ordering \`JournalEntry\`."""
enum JournalEntryOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  BOOK_ID_ASC
  BOOK_ID_DESC
  DATE_ASC
  DATE_DESC
  SOURCE_REFERENCE_ID_ASC
  SOURCE_REFERENCE_ID_DESC
}

"""A connection to a list of \`NetWorthSnapshot\` values."""
type NetWorthSnapshotConnection {
  """A list of \`NetWorthSnapshot\` objects."""
  nodes: [NetWorthSnapshot]!

  """
  A list of edges which contains the \`NetWorthSnapshot\` and cursor to aid in pagination.
  """
  edges: [NetWorthSnapshotEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """
  The count of *all* \`NetWorthSnapshot\` you could get from the connection.
  """
  totalCount: Int!
}

type NetWorthSnapshot implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  bookId: UUID!
  date: Datetime!
  totalAssets: BigFloat!
  totalLiabilities: BigFloat!
  netWorth: BigFloat!
  breakdown: String
  createdAt: Datetime

  """Reads a single \`Book\` that is related to this \`NetWorthSnapshot\`."""
  book: Book
}

"""A \`NetWorthSnapshot\` edge in the connection."""
type NetWorthSnapshotEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`NetWorthSnapshot\` at the end of the edge."""
  node: NetWorthSnapshot
}

"""
A condition to be used against \`NetWorthSnapshot\` object types. All fields are
tested for equality and combined with a logical ‘and.’
"""
input NetWorthSnapshotCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`bookId\` field."""
  bookId: UUID

  """Checks for equality with the object’s \`date\` field."""
  date: Datetime
}

"""Methods to use when ordering \`NetWorthSnapshot\`."""
enum NetWorthSnapshotOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  BOOK_ID_ASC
  BOOK_ID_DESC
  DATE_ASC
  DATE_DESC
}

"""A connection to a list of \`ReconciliationQueue\` values."""
type ReconciliationQueueConnection {
  """A list of \`ReconciliationQueue\` objects."""
  nodes: [ReconciliationQueue]!

  """
  A list of edges which contains the \`ReconciliationQueue\` and cursor to aid in pagination.
  """
  edges: [ReconciliationQueueEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """
  The count of *all* \`ReconciliationQueue\` you could get from the connection.
  """
  totalCount: Int!
}

type ReconciliationQueue implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  bookId: UUID!
  journalEntryId: UUID!
  status: ReconciliationStatus!
  reviewedAt: Datetime
  reviewedBy: String
  createdAt: Datetime
  categorizationSource: String
  confidence: BigFloat
  suggestedDebitAccountId: UUID
  suggestedCreditAccountId: UUID
  priority: Int!
  periodYear: Int
  periodMonth: Int

  """Reads a single \`Book\` that is related to this \`ReconciliationQueue\`."""
  book: Book

  """
  Reads a single \`JournalEntry\` that is related to this \`ReconciliationQueue\`.
  """
  journalEntry: JournalEntry

  """
  Reads a single \`Account\` that is related to this \`ReconciliationQueue\`.
  """
  suggestedCreditAccount: Account

  """
  Reads a single \`Account\` that is related to this \`ReconciliationQueue\`.
  """
  suggestedDebitAccount: Account
}

"""A \`ReconciliationQueue\` edge in the connection."""
type ReconciliationQueueEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`ReconciliationQueue\` at the end of the edge."""
  node: ReconciliationQueue
}

"""
A condition to be used against \`ReconciliationQueue\` object types. All fields
are tested for equality and combined with a logical ‘and.’
"""
input ReconciliationQueueCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`bookId\` field."""
  bookId: UUID

  """Checks for equality with the object’s \`status\` field."""
  status: ReconciliationStatus
}

"""Methods to use when ordering \`ReconciliationQueue\`."""
enum ReconciliationQueueOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  BOOK_ID_ASC
  BOOK_ID_DESC
}

"""A connection to a list of \`RecurringTransaction\` values."""
type RecurringTransactionConnection {
  """A list of \`RecurringTransaction\` objects."""
  nodes: [RecurringTransaction]!

  """
  A list of edges which contains the \`RecurringTransaction\` and cursor to aid in pagination.
  """
  edges: [RecurringTransactionEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """
  The count of *all* \`RecurringTransaction\` you could get from the connection.
  """
  totalCount: Int!
}

type RecurringTransaction implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  bookId: UUID!
  name: String!
  amount: BigFloat!
  frequency: RecurringFrequency!
  accountId: UUID!
  counterAccountId: UUID
  isAutoDetected: Boolean!
  isActive: Boolean!
  nextExpectedDate: Datetime
  createdAt: Datetime
  updatedAt: Datetime

  """
  Reads a single \`Account\` that is related to this \`RecurringTransaction\`.
  """
  account: Account

  """Reads a single \`Book\` that is related to this \`RecurringTransaction\`."""
  book: Book

  """
  Reads a single \`Account\` that is related to this \`RecurringTransaction\`.
  """
  counterAccount: Account
}

enum RecurringFrequency {
  weekly
  biweekly
  monthly
  quarterly
  yearly
}

"""A \`RecurringTransaction\` edge in the connection."""
type RecurringTransactionEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`RecurringTransaction\` at the end of the edge."""
  node: RecurringTransaction
}

"""
A condition to be used against \`RecurringTransaction\` object types. All fields
are tested for equality and combined with a logical ‘and.’
"""
input RecurringTransactionCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`bookId\` field."""
  bookId: UUID
}

"""Methods to use when ordering \`RecurringTransaction\`."""
enum RecurringTransactionOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  BOOK_ID_ASC
  BOOK_ID_DESC
}

"""A connection to a list of \`SavingsGoal\` values."""
type SavingsGoalConnection {
  """A list of \`SavingsGoal\` objects."""
  nodes: [SavingsGoal]!

  """
  A list of edges which contains the \`SavingsGoal\` and cursor to aid in pagination.
  """
  edges: [SavingsGoalEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """The count of *all* \`SavingsGoal\` you could get from the connection."""
  totalCount: Int!
}

type SavingsGoal implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  bookId: UUID!
  accountId: UUID!
  name: String!
  targetAmount: BigFloat!
  targetDate: Datetime
  createdAt: Datetime
  updatedAt: Datetime

  """Reads a single \`Account\` that is related to this \`SavingsGoal\`."""
  account: Account

  """Reads a single \`Book\` that is related to this \`SavingsGoal\`."""
  book: Book
}

"""A \`SavingsGoal\` edge in the connection."""
type SavingsGoalEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`SavingsGoal\` at the end of the edge."""
  node: SavingsGoal
}

"""
A condition to be used against \`SavingsGoal\` object types. All fields are tested
for equality and combined with a logical ‘and.’
"""
input SavingsGoalCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`bookId\` field."""
  bookId: UUID
}

"""Methods to use when ordering \`SavingsGoal\`."""
enum SavingsGoalOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  BOOK_ID_ASC
  BOOK_ID_DESC
}

"""A connection to a list of \`AccountingPeriod\` values."""
type AccountingPeriodConnection {
  """A list of \`AccountingPeriod\` objects."""
  nodes: [AccountingPeriod]!

  """
  A list of edges which contains the \`AccountingPeriod\` and cursor to aid in pagination.
  """
  edges: [AccountingPeriodEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """
  The count of *all* \`AccountingPeriod\` you could get from the connection.
  """
  totalCount: Int!
}

type AccountingPeriod implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  bookId: UUID!
  year: Int!
  month: Int!
  status: String!
  closedAt: Datetime
  closedBy: String
  reopenedAt: Datetime
  blockers: JSON
  createdAt: Datetime

  """Reads a single \`Book\` that is related to this \`AccountingPeriod\`."""
  book: Book
}

"""
Represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf).
"""
scalar JSON

"""A \`AccountingPeriod\` edge in the connection."""
type AccountingPeriodEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`AccountingPeriod\` at the end of the edge."""
  node: AccountingPeriod
}

"""
A condition to be used against \`AccountingPeriod\` object types. All fields are
tested for equality and combined with a logical ‘and.’
"""
input AccountingPeriodCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`bookId\` field."""
  bookId: UUID

  """Checks for equality with the object’s \`year\` field."""
  year: Int

  """Checks for equality with the object’s \`month\` field."""
  month: Int

  """Checks for equality with the object’s \`status\` field."""
  status: String
}

"""Methods to use when ordering \`AccountingPeriod\`."""
enum AccountingPeriodOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  BOOK_ID_ASC
  BOOK_ID_DESC
  YEAR_ASC
  YEAR_DESC
  MONTH_ASC
  MONTH_DESC
  STATUS_ASC
  STATUS_DESC
}

"""A connection to a list of \`CategorizationRule\` values."""
type CategorizationRuleConnection {
  """A list of \`CategorizationRule\` objects."""
  nodes: [CategorizationRule]!

  """
  A list of edges which contains the \`CategorizationRule\` and cursor to aid in pagination.
  """
  edges: [CategorizationRuleEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """
  The count of *all* \`CategorizationRule\` you could get from the connection.
  """
  totalCount: Int!
}

type CategorizationRule implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  bookId: UUID!
  name: String!
  matchField: String!
  matchType: String!
  matchValue: String!
  amountMin: BigFloat
  amountMax: BigFloat
  debitAccountId: UUID!
  creditAccountId: UUID!
  confidence: BigFloat!
  priority: Int!
  hitCount: Int!
  lastHitAt: Datetime
  createdAt: Datetime

  """Reads a single \`Book\` that is related to this \`CategorizationRule\`."""
  book: Book

  """Reads a single \`Account\` that is related to this \`CategorizationRule\`."""
  creditAccount: Account

  """Reads a single \`Account\` that is related to this \`CategorizationRule\`."""
  debitAccount: Account
}

"""A \`CategorizationRule\` edge in the connection."""
type CategorizationRuleEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`CategorizationRule\` at the end of the edge."""
  node: CategorizationRule
}

"""
A condition to be used against \`CategorizationRule\` object types. All fields are
tested for equality and combined with a logical ‘and.’
"""
input CategorizationRuleCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`bookId\` field."""
  bookId: UUID

  """Checks for equality with the object’s \`matchField\` field."""
  matchField: String
}

"""Methods to use when ordering \`CategorizationRule\`."""
enum CategorizationRuleOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  BOOK_ID_ASC
  BOOK_ID_DESC
  MATCH_FIELD_ASC
  MATCH_FIELD_DESC
}

"""A connection to a list of \`FixedAsset\` values."""
type FixedAssetConnection {
  """A list of \`FixedAsset\` objects."""
  nodes: [FixedAsset]!

  """
  A list of edges which contains the \`FixedAsset\` and cursor to aid in pagination.
  """
  edges: [FixedAssetEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """The count of *all* \`FixedAsset\` you could get from the connection."""
  totalCount: Int!
}

type FixedAsset implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  bookId: UUID!
  name: String!
  description: String
  assetAccountId: UUID!
  depreciationExpenseAccountId: UUID!
  accumulatedDepreciationAccountId: UUID!
  acquisitionDate: String!
  acquisitionCost: BigFloat!
  salvageValue: BigFloat!
  usefulLifeMonths: Int!
  depreciationMethod: String!
  macrsClass: String
  disposedAt: String
  disposalProceeds: BigFloat
  createdAt: Datetime

  """Reads a single \`Account\` that is related to this \`FixedAsset\`."""
  accumulatedDepreciationAccount: Account

  """Reads a single \`Account\` that is related to this \`FixedAsset\`."""
  assetAccount: Account

  """Reads a single \`Book\` that is related to this \`FixedAsset\`."""
  book: Book

  """Reads a single \`Account\` that is related to this \`FixedAsset\`."""
  depreciationExpenseAccount: Account
}

"""A \`FixedAsset\` edge in the connection."""
type FixedAssetEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`FixedAsset\` at the end of the edge."""
  node: FixedAsset
}

"""
A condition to be used against \`FixedAsset\` object types. All fields are tested
for equality and combined with a logical ‘and.’
"""
input FixedAssetCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`bookId\` field."""
  bookId: UUID

  """Checks for equality with the object’s \`disposedAt\` field."""
  disposedAt: String
}

"""Methods to use when ordering \`FixedAsset\`."""
enum FixedAssetOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  BOOK_ID_ASC
  BOOK_ID_DESC
  DISPOSED_AT_ASC
  DISPOSED_AT_DESC
}

"""A connection to a list of \`_DrizzleMigration\` values."""
type _DrizzleMigrationConnection {
  """A list of \`_DrizzleMigration\` objects."""
  nodes: [_DrizzleMigration]!

  """
  A list of edges which contains the \`_DrizzleMigration\` and cursor to aid in pagination.
  """
  edges: [_DrizzleMigrationEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """
  The count of *all* \`_DrizzleMigration\` you could get from the connection.
  """
  totalCount: Int!
}

"""A \`_DrizzleMigration\` edge in the connection."""
type _DrizzleMigrationEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`_DrizzleMigration\` at the end of the edge."""
  node: _DrizzleMigration
}

"""
A condition to be used against \`_DrizzleMigration\` object types. All fields are
tested for equality and combined with a logical ‘and.’
"""
input _DrizzleMigrationCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: Int
}

"""
A filter to be used against \`_DrizzleMigration\` object types. All fields are combined with a logical ‘and.’
"""
input _DrizzleMigrationFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: IntFilter

  """Checks for all expressions in this list."""
  and: [_DrizzleMigrationFilter!]

  """Checks for any expressions in this list."""
  or: [_DrizzleMigrationFilter!]

  """Negates the expression."""
  not: _DrizzleMigrationFilter
}

"""Methods to use when ordering \`_DrizzleMigration\`."""
enum _DrizzleMigrationOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
}

"""A connection to a list of \`Book\` values."""
type BookConnection {
  """A list of \`Book\` objects."""
  nodes: [Book]!

  """
  A list of edges which contains the \`Book\` and cursor to aid in pagination.
  """
  edges: [BookEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """The count of *all* \`Book\` you could get from the connection."""
  totalCount: Int!
}

"""A \`Book\` edge in the connection."""
type BookEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`Book\` at the end of the edge."""
  node: Book
}

"""
A condition to be used against \`Book\` object types. All fields are tested for equality and combined with a logical ‘and.’
"""
input BookCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`organizationId\` field."""
  organizationId: String
}

"""Methods to use when ordering \`Book\`."""
enum BookOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  ORGANIZATION_ID_ASC
  ORGANIZATION_ID_DESC
}

"""
The root mutation type which contains root level fields which mutate data.
"""
type Mutation {
  """Creates a single \`_DrizzleMigration\`."""
  createDrizzleMigration(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateDrizzleMigrationInput!
  ): CreateDrizzleMigrationPayload

  """Creates a single \`AccountMapping\`."""
  createAccountMapping(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateAccountMappingInput!
  ): CreateAccountMappingPayload

  """Creates a single \`JournalLine\`."""
  createJournalLine(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateJournalLineInput!
  ): CreateJournalLinePayload

  """Creates a single \`SavingsGoal\`."""
  createSavingsGoal(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateSavingsGoalInput!
  ): CreateSavingsGoalPayload

  """Creates a single \`NetWorthSnapshot\`."""
  createNetWorthSnapshot(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateNetWorthSnapshotInput!
  ): CreateNetWorthSnapshotPayload

  """Creates a single \`AccountingPeriod\`."""
  createAccountingPeriod(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateAccountingPeriodInput!
  ): CreateAccountingPeriodPayload

  """Creates a single \`CryptoLot\`."""
  createCryptoLot(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateCryptoLotInput!
  ): CreateCryptoLotPayload

  """Creates a single \`Book\`."""
  createBook(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateBookInput!
  ): CreateBookPayload

  """Creates a single \`Budget\`."""
  createBudget(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateBudgetInput!
  ): CreateBudgetPayload

  """Creates a single \`CryptoAsset\`."""
  createCryptoAsset(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateCryptoAssetInput!
  ): CreateCryptoAssetPayload

  """Creates a single \`CategorizationRule\`."""
  createCategorizationRule(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateCategorizationRuleInput!
  ): CreateCategorizationRulePayload

  """Creates a single \`JournalEntry\`."""
  createJournalEntry(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateJournalEntryInput!
  ): CreateJournalEntryPayload

  """Creates a single \`FixedAsset\`."""
  createFixedAsset(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateFixedAssetInput!
  ): CreateFixedAssetPayload

  """Creates a single \`RecurringTransaction\`."""
  createRecurringTransaction(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateRecurringTransactionInput!
  ): CreateRecurringTransactionPayload

  """Creates a single \`ReconciliationQueue\`."""
  createReconciliationQueue(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateReconciliationQueueInput!
  ): CreateReconciliationQueuePayload

  """Creates a single \`Account\`."""
  createAccount(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateAccountInput!
  ): CreateAccountPayload

  """Creates a single \`ConnectedAccount\`."""
  createConnectedAccount(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateConnectedAccountInput!
  ): CreateConnectedAccountPayload

  """
  Updates a single \`_DrizzleMigration\` using its globally unique id and a patch.
  """
  updateDrizzleMigrationById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateDrizzleMigrationByIdInput!
  ): UpdateDrizzleMigrationPayload

  """Updates a single \`_DrizzleMigration\` using a unique key and a patch."""
  updateDrizzleMigration(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateDrizzleMigrationInput!
  ): UpdateDrizzleMigrationPayload

  """
  Updates a single \`AccountMapping\` using its globally unique id and a patch.
  """
  updateAccountMappingById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateAccountMappingByIdInput!
  ): UpdateAccountMappingPayload

  """Updates a single \`AccountMapping\` using a unique key and a patch."""
  updateAccountMapping(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateAccountMappingInput!
  ): UpdateAccountMappingPayload

  """
  Updates a single \`JournalLine\` using its globally unique id and a patch.
  """
  updateJournalLineById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateJournalLineByIdInput!
  ): UpdateJournalLinePayload

  """Updates a single \`JournalLine\` using a unique key and a patch."""
  updateJournalLine(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateJournalLineInput!
  ): UpdateJournalLinePayload

  """
  Updates a single \`SavingsGoal\` using its globally unique id and a patch.
  """
  updateSavingsGoalById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateSavingsGoalByIdInput!
  ): UpdateSavingsGoalPayload

  """Updates a single \`SavingsGoal\` using a unique key and a patch."""
  updateSavingsGoal(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateSavingsGoalInput!
  ): UpdateSavingsGoalPayload

  """
  Updates a single \`NetWorthSnapshot\` using its globally unique id and a patch.
  """
  updateNetWorthSnapshotById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateNetWorthSnapshotByIdInput!
  ): UpdateNetWorthSnapshotPayload

  """Updates a single \`NetWorthSnapshot\` using a unique key and a patch."""
  updateNetWorthSnapshot(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateNetWorthSnapshotInput!
  ): UpdateNetWorthSnapshotPayload

  """
  Updates a single \`AccountingPeriod\` using its globally unique id and a patch.
  """
  updateAccountingPeriodById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateAccountingPeriodByIdInput!
  ): UpdateAccountingPeriodPayload

  """Updates a single \`AccountingPeriod\` using a unique key and a patch."""
  updateAccountingPeriod(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateAccountingPeriodInput!
  ): UpdateAccountingPeriodPayload

  """Updates a single \`CryptoLot\` using its globally unique id and a patch."""
  updateCryptoLotById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateCryptoLotByIdInput!
  ): UpdateCryptoLotPayload

  """Updates a single \`CryptoLot\` using a unique key and a patch."""
  updateCryptoLot(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateCryptoLotInput!
  ): UpdateCryptoLotPayload

  """Updates a single \`Book\` using its globally unique id and a patch."""
  updateBookById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateBookByIdInput!
  ): UpdateBookPayload

  """Updates a single \`Book\` using a unique key and a patch."""
  updateBook(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateBookInput!
  ): UpdateBookPayload

  """Updates a single \`Budget\` using its globally unique id and a patch."""
  updateBudgetById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateBudgetByIdInput!
  ): UpdateBudgetPayload

  """Updates a single \`Budget\` using a unique key and a patch."""
  updateBudget(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateBudgetInput!
  ): UpdateBudgetPayload

  """
  Updates a single \`CryptoAsset\` using its globally unique id and a patch.
  """
  updateCryptoAssetById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateCryptoAssetByIdInput!
  ): UpdateCryptoAssetPayload

  """Updates a single \`CryptoAsset\` using a unique key and a patch."""
  updateCryptoAsset(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateCryptoAssetInput!
  ): UpdateCryptoAssetPayload

  """
  Updates a single \`CategorizationRule\` using its globally unique id and a patch.
  """
  updateCategorizationRuleById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateCategorizationRuleByIdInput!
  ): UpdateCategorizationRulePayload

  """Updates a single \`CategorizationRule\` using a unique key and a patch."""
  updateCategorizationRule(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateCategorizationRuleInput!
  ): UpdateCategorizationRulePayload

  """
  Updates a single \`JournalEntry\` using its globally unique id and a patch.
  """
  updateJournalEntryById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateJournalEntryByIdInput!
  ): UpdateJournalEntryPayload

  """Updates a single \`JournalEntry\` using a unique key and a patch."""
  updateJournalEntry(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateJournalEntryInput!
  ): UpdateJournalEntryPayload

  """
  Updates a single \`FixedAsset\` using its globally unique id and a patch.
  """
  updateFixedAssetById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateFixedAssetByIdInput!
  ): UpdateFixedAssetPayload

  """Updates a single \`FixedAsset\` using a unique key and a patch."""
  updateFixedAsset(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateFixedAssetInput!
  ): UpdateFixedAssetPayload

  """
  Updates a single \`RecurringTransaction\` using its globally unique id and a patch.
  """
  updateRecurringTransactionById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateRecurringTransactionByIdInput!
  ): UpdateRecurringTransactionPayload

  """
  Updates a single \`RecurringTransaction\` using a unique key and a patch.
  """
  updateRecurringTransaction(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateRecurringTransactionInput!
  ): UpdateRecurringTransactionPayload

  """
  Updates a single \`ReconciliationQueue\` using its globally unique id and a patch.
  """
  updateReconciliationQueueById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateReconciliationQueueByIdInput!
  ): UpdateReconciliationQueuePayload

  """Updates a single \`ReconciliationQueue\` using a unique key and a patch."""
  updateReconciliationQueue(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateReconciliationQueueInput!
  ): UpdateReconciliationQueuePayload

  """Updates a single \`Account\` using its globally unique id and a patch."""
  updateAccountById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateAccountByIdInput!
  ): UpdateAccountPayload

  """Updates a single \`Account\` using a unique key and a patch."""
  updateAccount(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateAccountInput!
  ): UpdateAccountPayload

  """
  Updates a single \`ConnectedAccount\` using its globally unique id and a patch.
  """
  updateConnectedAccountById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateConnectedAccountByIdInput!
  ): UpdateConnectedAccountPayload

  """Updates a single \`ConnectedAccount\` using a unique key and a patch."""
  updateConnectedAccount(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateConnectedAccountInput!
  ): UpdateConnectedAccountPayload

  """Deletes a single \`_DrizzleMigration\` using its globally unique id."""
  deleteDrizzleMigrationById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteDrizzleMigrationByIdInput!
  ): DeleteDrizzleMigrationPayload

  """Deletes a single \`_DrizzleMigration\` using a unique key."""
  deleteDrizzleMigration(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteDrizzleMigrationInput!
  ): DeleteDrizzleMigrationPayload

  """Deletes a single \`AccountMapping\` using its globally unique id."""
  deleteAccountMappingById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteAccountMappingByIdInput!
  ): DeleteAccountMappingPayload

  """Deletes a single \`AccountMapping\` using a unique key."""
  deleteAccountMapping(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteAccountMappingInput!
  ): DeleteAccountMappingPayload

  """Deletes a single \`JournalLine\` using its globally unique id."""
  deleteJournalLineById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteJournalLineByIdInput!
  ): DeleteJournalLinePayload

  """Deletes a single \`JournalLine\` using a unique key."""
  deleteJournalLine(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteJournalLineInput!
  ): DeleteJournalLinePayload

  """Deletes a single \`SavingsGoal\` using its globally unique id."""
  deleteSavingsGoalById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteSavingsGoalByIdInput!
  ): DeleteSavingsGoalPayload

  """Deletes a single \`SavingsGoal\` using a unique key."""
  deleteSavingsGoal(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteSavingsGoalInput!
  ): DeleteSavingsGoalPayload

  """Deletes a single \`NetWorthSnapshot\` using its globally unique id."""
  deleteNetWorthSnapshotById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteNetWorthSnapshotByIdInput!
  ): DeleteNetWorthSnapshotPayload

  """Deletes a single \`NetWorthSnapshot\` using a unique key."""
  deleteNetWorthSnapshot(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteNetWorthSnapshotInput!
  ): DeleteNetWorthSnapshotPayload

  """Deletes a single \`AccountingPeriod\` using its globally unique id."""
  deleteAccountingPeriodById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteAccountingPeriodByIdInput!
  ): DeleteAccountingPeriodPayload

  """Deletes a single \`AccountingPeriod\` using a unique key."""
  deleteAccountingPeriod(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteAccountingPeriodInput!
  ): DeleteAccountingPeriodPayload

  """Deletes a single \`CryptoLot\` using its globally unique id."""
  deleteCryptoLotById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteCryptoLotByIdInput!
  ): DeleteCryptoLotPayload

  """Deletes a single \`CryptoLot\` using a unique key."""
  deleteCryptoLot(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteCryptoLotInput!
  ): DeleteCryptoLotPayload

  """Deletes a single \`Book\` using its globally unique id."""
  deleteBookById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteBookByIdInput!
  ): DeleteBookPayload

  """Deletes a single \`Book\` using a unique key."""
  deleteBook(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteBookInput!
  ): DeleteBookPayload

  """Deletes a single \`Budget\` using its globally unique id."""
  deleteBudgetById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteBudgetByIdInput!
  ): DeleteBudgetPayload

  """Deletes a single \`Budget\` using a unique key."""
  deleteBudget(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteBudgetInput!
  ): DeleteBudgetPayload

  """Deletes a single \`CryptoAsset\` using its globally unique id."""
  deleteCryptoAssetById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteCryptoAssetByIdInput!
  ): DeleteCryptoAssetPayload

  """Deletes a single \`CryptoAsset\` using a unique key."""
  deleteCryptoAsset(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteCryptoAssetInput!
  ): DeleteCryptoAssetPayload

  """Deletes a single \`CategorizationRule\` using its globally unique id."""
  deleteCategorizationRuleById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteCategorizationRuleByIdInput!
  ): DeleteCategorizationRulePayload

  """Deletes a single \`CategorizationRule\` using a unique key."""
  deleteCategorizationRule(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteCategorizationRuleInput!
  ): DeleteCategorizationRulePayload

  """Deletes a single \`JournalEntry\` using its globally unique id."""
  deleteJournalEntryById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteJournalEntryByIdInput!
  ): DeleteJournalEntryPayload

  """Deletes a single \`JournalEntry\` using a unique key."""
  deleteJournalEntry(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteJournalEntryInput!
  ): DeleteJournalEntryPayload

  """Deletes a single \`FixedAsset\` using its globally unique id."""
  deleteFixedAssetById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteFixedAssetByIdInput!
  ): DeleteFixedAssetPayload

  """Deletes a single \`FixedAsset\` using a unique key."""
  deleteFixedAsset(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteFixedAssetInput!
  ): DeleteFixedAssetPayload

  """Deletes a single \`RecurringTransaction\` using its globally unique id."""
  deleteRecurringTransactionById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteRecurringTransactionByIdInput!
  ): DeleteRecurringTransactionPayload

  """Deletes a single \`RecurringTransaction\` using a unique key."""
  deleteRecurringTransaction(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteRecurringTransactionInput!
  ): DeleteRecurringTransactionPayload

  """Deletes a single \`ReconciliationQueue\` using its globally unique id."""
  deleteReconciliationQueueById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteReconciliationQueueByIdInput!
  ): DeleteReconciliationQueuePayload

  """Deletes a single \`ReconciliationQueue\` using a unique key."""
  deleteReconciliationQueue(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteReconciliationQueueInput!
  ): DeleteReconciliationQueuePayload

  """Deletes a single \`Account\` using its globally unique id."""
  deleteAccountById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteAccountByIdInput!
  ): DeleteAccountPayload

  """Deletes a single \`Account\` using a unique key."""
  deleteAccount(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteAccountInput!
  ): DeleteAccountPayload

  """Deletes a single \`ConnectedAccount\` using its globally unique id."""
  deleteConnectedAccountById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteConnectedAccountByIdInput!
  ): DeleteConnectedAccountPayload

  """Deletes a single \`ConnectedAccount\` using a unique key."""
  deleteConnectedAccount(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteConnectedAccountInput!
  ): DeleteConnectedAccountPayload
}

"""The output of our create \`_DrizzleMigration\` mutation."""
type CreateDrizzleMigrationPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`_DrizzleMigration\` that was created by this mutation."""
  _drizzleMigration: _DrizzleMigration

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`_DrizzleMigration\`. May be used by Relay 1."""
  _drizzleMigrationEdge(
    """The method to use when ordering \`_DrizzleMigration\`."""
    orderBy: [_DrizzleMigrationOrderBy!]! = [PRIMARY_KEY_ASC]
  ): _DrizzleMigrationEdge
}

"""All input for the create \`_DrizzleMigration\` mutation."""
input CreateDrizzleMigrationInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`_DrizzleMigration\` to be created by this mutation."""
  _drizzleMigration: _DrizzleMigrationInput!
}

"""An input for mutations affecting \`_DrizzleMigration\`"""
input _DrizzleMigrationInput {
  rowId: Int
  hash: String!
  createdAt: BigInt
}

"""The output of our create \`AccountMapping\` mutation."""
type CreateAccountMappingPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`AccountMapping\` that was created by this mutation."""
  accountMapping: AccountMapping

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`AccountMapping\`. May be used by Relay 1."""
  accountMappingEdge(
    """The method to use when ordering \`AccountMapping\`."""
    orderBy: [AccountMappingOrderBy!]! = [PRIMARY_KEY_ASC]
  ): AccountMappingEdge
}

"""All input for the create \`AccountMapping\` mutation."""
input CreateAccountMappingInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`AccountMapping\` to be created by this mutation."""
  accountMapping: AccountMappingInput!
}

"""An input for mutations affecting \`AccountMapping\`"""
input AccountMappingInput {
  rowId: UUID
  bookId: UUID!
  eventType: String!
  debitAccountId: UUID!
  creditAccountId: UUID!
  createdAt: Datetime
  updatedAt: Datetime
}

"""The output of our create \`JournalLine\` mutation."""
type CreateJournalLinePayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`JournalLine\` that was created by this mutation."""
  journalLine: JournalLine

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`JournalLine\`. May be used by Relay 1."""
  journalLineEdge(
    """The method to use when ordering \`JournalLine\`."""
    orderBy: [JournalLineOrderBy!]! = [PRIMARY_KEY_ASC]
  ): JournalLineEdge
}

"""All input for the create \`JournalLine\` mutation."""
input CreateJournalLineInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`JournalLine\` to be created by this mutation."""
  journalLine: JournalLineInput!
}

"""An input for mutations affecting \`JournalLine\`"""
input JournalLineInput {
  rowId: UUID
  journalEntryId: UUID!
  accountId: UUID!
  debit: BigFloat
  credit: BigFloat
  memo: String
}

"""The output of our create \`SavingsGoal\` mutation."""
type CreateSavingsGoalPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`SavingsGoal\` that was created by this mutation."""
  savingsGoal: SavingsGoal

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`SavingsGoal\`. May be used by Relay 1."""
  savingsGoalEdge(
    """The method to use when ordering \`SavingsGoal\`."""
    orderBy: [SavingsGoalOrderBy!]! = [PRIMARY_KEY_ASC]
  ): SavingsGoalEdge
}

"""All input for the create \`SavingsGoal\` mutation."""
input CreateSavingsGoalInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`SavingsGoal\` to be created by this mutation."""
  savingsGoal: SavingsGoalInput!
}

"""An input for mutations affecting \`SavingsGoal\`"""
input SavingsGoalInput {
  rowId: UUID
  bookId: UUID!
  accountId: UUID!
  name: String!
  targetAmount: BigFloat!
  targetDate: Datetime
  createdAt: Datetime
  updatedAt: Datetime
}

"""The output of our create \`NetWorthSnapshot\` mutation."""
type CreateNetWorthSnapshotPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`NetWorthSnapshot\` that was created by this mutation."""
  netWorthSnapshot: NetWorthSnapshot

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`NetWorthSnapshot\`. May be used by Relay 1."""
  netWorthSnapshotEdge(
    """The method to use when ordering \`NetWorthSnapshot\`."""
    orderBy: [NetWorthSnapshotOrderBy!]! = [PRIMARY_KEY_ASC]
  ): NetWorthSnapshotEdge
}

"""All input for the create \`NetWorthSnapshot\` mutation."""
input CreateNetWorthSnapshotInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`NetWorthSnapshot\` to be created by this mutation."""
  netWorthSnapshot: NetWorthSnapshotInput!
}

"""An input for mutations affecting \`NetWorthSnapshot\`"""
input NetWorthSnapshotInput {
  rowId: UUID
  bookId: UUID!
  date: Datetime!
  totalAssets: BigFloat!
  totalLiabilities: BigFloat!
  netWorth: BigFloat!
  breakdown: String
  createdAt: Datetime
}

"""The output of our create \`AccountingPeriod\` mutation."""
type CreateAccountingPeriodPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`AccountingPeriod\` that was created by this mutation."""
  accountingPeriod: AccountingPeriod

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`AccountingPeriod\`. May be used by Relay 1."""
  accountingPeriodEdge(
    """The method to use when ordering \`AccountingPeriod\`."""
    orderBy: [AccountingPeriodOrderBy!]! = [PRIMARY_KEY_ASC]
  ): AccountingPeriodEdge
}

"""All input for the create \`AccountingPeriod\` mutation."""
input CreateAccountingPeriodInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`AccountingPeriod\` to be created by this mutation."""
  accountingPeriod: AccountingPeriodInput!
}

"""An input for mutations affecting \`AccountingPeriod\`"""
input AccountingPeriodInput {
  rowId: UUID
  bookId: UUID!
  year: Int!
  month: Int!
  status: String
  closedAt: Datetime
  closedBy: String
  reopenedAt: Datetime
  blockers: JSON
  createdAt: Datetime
}

"""The output of our create \`CryptoLot\` mutation."""
type CreateCryptoLotPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`CryptoLot\` that was created by this mutation."""
  cryptoLot: CryptoLot

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`CryptoLot\`. May be used by Relay 1."""
  cryptoLotEdge(
    """The method to use when ordering \`CryptoLot\`."""
    orderBy: [CryptoLotOrderBy!]! = [PRIMARY_KEY_ASC]
  ): CryptoLotEdge
}

"""All input for the create \`CryptoLot\` mutation."""
input CreateCryptoLotInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`CryptoLot\` to be created by this mutation."""
  cryptoLot: CryptoLotInput!
}

"""An input for mutations affecting \`CryptoLot\`"""
input CryptoLotInput {
  rowId: UUID
  cryptoAssetId: UUID!
  acquiredAt: Datetime!
  quantity: BigFloat!
  costPerUnit: BigFloat!
  remainingQuantity: BigFloat!
  disposedAt: Datetime
  proceedsPerUnit: BigFloat
  journalEntryId: UUID
  createdAt: Datetime
}

"""The output of our create \`Book\` mutation."""
type CreateBookPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Book\` that was created by this mutation."""
  book: Book

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Book\`. May be used by Relay 1."""
  bookEdge(
    """The method to use when ordering \`Book\`."""
    orderBy: [BookOrderBy!]! = [PRIMARY_KEY_ASC]
  ): BookEdge
}

"""All input for the create \`Book\` mutation."""
input CreateBookInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`Book\` to be created by this mutation."""
  book: BookInput!
}

"""An input for mutations affecting \`Book\`"""
input BookInput {
  rowId: UUID
  organizationId: String!
  name: String!
  type: BookType!
  currency: String
  fiscalYearStartMonth: Int
  createdAt: Datetime
  updatedAt: Datetime
}

"""The output of our create \`Budget\` mutation."""
type CreateBudgetPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Budget\` that was created by this mutation."""
  budget: Budget

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Budget\`. May be used by Relay 1."""
  budgetEdge(
    """The method to use when ordering \`Budget\`."""
    orderBy: [BudgetOrderBy!]! = [PRIMARY_KEY_ASC]
  ): BudgetEdge
}

"""All input for the create \`Budget\` mutation."""
input CreateBudgetInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`Budget\` to be created by this mutation."""
  budget: BudgetInput!
}

"""An input for mutations affecting \`Budget\`"""
input BudgetInput {
  rowId: UUID
  bookId: UUID!
  accountId: UUID!
  amount: BigFloat!
  period: BudgetPeriod
  rollover: Boolean
  createdAt: Datetime
  updatedAt: Datetime
}

"""The output of our create \`CryptoAsset\` mutation."""
type CreateCryptoAssetPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`CryptoAsset\` that was created by this mutation."""
  cryptoAsset: CryptoAsset

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`CryptoAsset\`. May be used by Relay 1."""
  cryptoAssetEdge(
    """The method to use when ordering \`CryptoAsset\`."""
    orderBy: [CryptoAssetOrderBy!]! = [PRIMARY_KEY_ASC]
  ): CryptoAssetEdge
}

"""All input for the create \`CryptoAsset\` mutation."""
input CreateCryptoAssetInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`CryptoAsset\` to be created by this mutation."""
  cryptoAsset: CryptoAssetInput!
}

"""An input for mutations affecting \`CryptoAsset\`"""
input CryptoAssetInput {
  rowId: UUID
  bookId: UUID!
  symbol: String!
  name: String!
  walletAddress: String
  network: String
  balance: BigFloat
  costBasisMethod: CostBasisMethod
  lastSyncedAt: Datetime
  createdAt: Datetime
  updatedAt: Datetime
}

"""The output of our create \`CategorizationRule\` mutation."""
type CreateCategorizationRulePayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`CategorizationRule\` that was created by this mutation."""
  categorizationRule: CategorizationRule

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`CategorizationRule\`. May be used by Relay 1."""
  categorizationRuleEdge(
    """The method to use when ordering \`CategorizationRule\`."""
    orderBy: [CategorizationRuleOrderBy!]! = [PRIMARY_KEY_ASC]
  ): CategorizationRuleEdge
}

"""All input for the create \`CategorizationRule\` mutation."""
input CreateCategorizationRuleInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`CategorizationRule\` to be created by this mutation."""
  categorizationRule: CategorizationRuleInput!
}

"""An input for mutations affecting \`CategorizationRule\`"""
input CategorizationRuleInput {
  rowId: UUID
  bookId: UUID!
  name: String!
  matchField: String!
  matchType: String!
  matchValue: String!
  amountMin: BigFloat
  amountMax: BigFloat
  debitAccountId: UUID!
  creditAccountId: UUID!
  confidence: BigFloat
  priority: Int
  hitCount: Int
  lastHitAt: Datetime
  createdAt: Datetime
}

"""The output of our create \`JournalEntry\` mutation."""
type CreateJournalEntryPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`JournalEntry\` that was created by this mutation."""
  journalEntry: JournalEntry

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`JournalEntry\`. May be used by Relay 1."""
  journalEntryEdge(
    """The method to use when ordering \`JournalEntry\`."""
    orderBy: [JournalEntryOrderBy!]! = [PRIMARY_KEY_ASC]
  ): JournalEntryEdge
}

"""All input for the create \`JournalEntry\` mutation."""
input CreateJournalEntryInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`JournalEntry\` to be created by this mutation."""
  journalEntry: JournalEntryInput!
}

"""An input for mutations affecting \`JournalEntry\`"""
input JournalEntryInput {
  rowId: UUID
  bookId: UUID!
  date: Datetime!
  memo: String
  source: JournalEntrySource
  sourceReferenceId: String
  isReviewed: Boolean
  isReconciled: Boolean
  createdAt: Datetime
  updatedAt: Datetime
}

"""The output of our create \`FixedAsset\` mutation."""
type CreateFixedAssetPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`FixedAsset\` that was created by this mutation."""
  fixedAsset: FixedAsset

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`FixedAsset\`. May be used by Relay 1."""
  fixedAssetEdge(
    """The method to use when ordering \`FixedAsset\`."""
    orderBy: [FixedAssetOrderBy!]! = [PRIMARY_KEY_ASC]
  ): FixedAssetEdge
}

"""All input for the create \`FixedAsset\` mutation."""
input CreateFixedAssetInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`FixedAsset\` to be created by this mutation."""
  fixedAsset: FixedAssetInput!
}

"""An input for mutations affecting \`FixedAsset\`"""
input FixedAssetInput {
  rowId: UUID
  bookId: UUID!
  name: String!
  description: String
  assetAccountId: UUID!
  depreciationExpenseAccountId: UUID!
  accumulatedDepreciationAccountId: UUID!
  acquisitionDate: String!
  acquisitionCost: BigFloat!
  salvageValue: BigFloat
  usefulLifeMonths: Int!
  depreciationMethod: String!
  macrsClass: String
  disposedAt: String
  disposalProceeds: BigFloat
  createdAt: Datetime
}

"""The output of our create \`RecurringTransaction\` mutation."""
type CreateRecurringTransactionPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`RecurringTransaction\` that was created by this mutation."""
  recurringTransaction: RecurringTransaction

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`RecurringTransaction\`. May be used by Relay 1."""
  recurringTransactionEdge(
    """The method to use when ordering \`RecurringTransaction\`."""
    orderBy: [RecurringTransactionOrderBy!]! = [PRIMARY_KEY_ASC]
  ): RecurringTransactionEdge
}

"""All input for the create \`RecurringTransaction\` mutation."""
input CreateRecurringTransactionInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`RecurringTransaction\` to be created by this mutation."""
  recurringTransaction: RecurringTransactionInput!
}

"""An input for mutations affecting \`RecurringTransaction\`"""
input RecurringTransactionInput {
  rowId: UUID
  bookId: UUID!
  name: String!
  amount: BigFloat!
  frequency: RecurringFrequency!
  accountId: UUID!
  counterAccountId: UUID
  isAutoDetected: Boolean
  isActive: Boolean
  nextExpectedDate: Datetime
  createdAt: Datetime
  updatedAt: Datetime
}

"""The output of our create \`ReconciliationQueue\` mutation."""
type CreateReconciliationQueuePayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`ReconciliationQueue\` that was created by this mutation."""
  reconciliationQueue: ReconciliationQueue

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`ReconciliationQueue\`. May be used by Relay 1."""
  reconciliationQueueEdge(
    """The method to use when ordering \`ReconciliationQueue\`."""
    orderBy: [ReconciliationQueueOrderBy!]! = [PRIMARY_KEY_ASC]
  ): ReconciliationQueueEdge
}

"""All input for the create \`ReconciliationQueue\` mutation."""
input CreateReconciliationQueueInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`ReconciliationQueue\` to be created by this mutation."""
  reconciliationQueue: ReconciliationQueueInput!
}

"""An input for mutations affecting \`ReconciliationQueue\`"""
input ReconciliationQueueInput {
  rowId: UUID
  bookId: UUID!
  journalEntryId: UUID!
  status: ReconciliationStatus
  reviewedAt: Datetime
  reviewedBy: String
  createdAt: Datetime
  categorizationSource: String
  confidence: BigFloat
  suggestedDebitAccountId: UUID
  suggestedCreditAccountId: UUID
  priority: Int
  periodYear: Int
  periodMonth: Int
}

"""The output of our create \`Account\` mutation."""
type CreateAccountPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Account\` that was created by this mutation."""
  account: Account

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Account\`. May be used by Relay 1."""
  accountEdge(
    """The method to use when ordering \`Account\`."""
    orderBy: [AccountOrderBy!]! = [PRIMARY_KEY_ASC]
  ): AccountEdge
}

"""All input for the create \`Account\` mutation."""
input CreateAccountInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`Account\` to be created by this mutation."""
  account: AccountInput!
}

"""An input for mutations affecting \`Account\`"""
input AccountInput {
  rowId: UUID
  bookId: UUID!
  parentId: UUID
  name: String!
  code: String
  type: AccountType!
  subType: AccountSubType
  isPlaceholder: Boolean
  isActive: Boolean
  createdAt: Datetime
  updatedAt: Datetime
}

"""The output of our create \`ConnectedAccount\` mutation."""
type CreateConnectedAccountPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`ConnectedAccount\` that was created by this mutation."""
  connectedAccount: ConnectedAccount

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`ConnectedAccount\`. May be used by Relay 1."""
  connectedAccountEdge(
    """The method to use when ordering \`ConnectedAccount\`."""
    orderBy: [ConnectedAccountOrderBy!]! = [PRIMARY_KEY_ASC]
  ): ConnectedAccountEdge
}

"""All input for the create \`ConnectedAccount\` mutation."""
input CreateConnectedAccountInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`ConnectedAccount\` to be created by this mutation."""
  connectedAccount: ConnectedAccountInput!
}

"""An input for mutations affecting \`ConnectedAccount\`"""
input ConnectedAccountInput {
  rowId: UUID
  bookId: UUID!
  provider: ConnectedAccountProvider!
  providerAccountId: String
  accountId: UUID
  institutionName: String
  mask: String
  status: ConnectedAccountStatus
  accessToken: String
  lastSyncedAt: Datetime
  createdAt: Datetime
  syncCursor: String
}

"""The output of our update \`_DrizzleMigration\` mutation."""
type UpdateDrizzleMigrationPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`_DrizzleMigration\` that was updated by this mutation."""
  _drizzleMigration: _DrizzleMigration

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`_DrizzleMigration\`. May be used by Relay 1."""
  _drizzleMigrationEdge(
    """The method to use when ordering \`_DrizzleMigration\`."""
    orderBy: [_DrizzleMigrationOrderBy!]! = [PRIMARY_KEY_ASC]
  ): _DrizzleMigrationEdge
}

"""All input for the \`updateDrizzleMigrationById\` mutation."""
input UpdateDrizzleMigrationByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`_DrizzleMigration\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`_DrizzleMigration\` being updated.
  """
  patch: _DrizzleMigrationPatch!
}

"""
Represents an update to a \`_DrizzleMigration\`. Fields that are set will be updated.
"""
input _DrizzleMigrationPatch {
  rowId: Int
  hash: String
  createdAt: BigInt
}

"""All input for the \`updateDrizzleMigration\` mutation."""
input UpdateDrizzleMigrationInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: Int!

  """
  An object where the defined keys will be set on the \`_DrizzleMigration\` being updated.
  """
  patch: _DrizzleMigrationPatch!
}

"""The output of our update \`AccountMapping\` mutation."""
type UpdateAccountMappingPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`AccountMapping\` that was updated by this mutation."""
  accountMapping: AccountMapping

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`AccountMapping\`. May be used by Relay 1."""
  accountMappingEdge(
    """The method to use when ordering \`AccountMapping\`."""
    orderBy: [AccountMappingOrderBy!]! = [PRIMARY_KEY_ASC]
  ): AccountMappingEdge
}

"""All input for the \`updateAccountMappingById\` mutation."""
input UpdateAccountMappingByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`AccountMapping\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`AccountMapping\` being updated.
  """
  patch: AccountMappingPatch!
}

"""
Represents an update to a \`AccountMapping\`. Fields that are set will be updated.
"""
input AccountMappingPatch {
  rowId: UUID
  bookId: UUID
  eventType: String
  debitAccountId: UUID
  creditAccountId: UUID
  createdAt: Datetime
  updatedAt: Datetime
}

"""All input for the \`updateAccountMapping\` mutation."""
input UpdateAccountMappingInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`AccountMapping\` being updated.
  """
  patch: AccountMappingPatch!
}

"""The output of our update \`JournalLine\` mutation."""
type UpdateJournalLinePayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`JournalLine\` that was updated by this mutation."""
  journalLine: JournalLine

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`JournalLine\`. May be used by Relay 1."""
  journalLineEdge(
    """The method to use when ordering \`JournalLine\`."""
    orderBy: [JournalLineOrderBy!]! = [PRIMARY_KEY_ASC]
  ): JournalLineEdge
}

"""All input for the \`updateJournalLineById\` mutation."""
input UpdateJournalLineByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`JournalLine\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`JournalLine\` being updated.
  """
  patch: JournalLinePatch!
}

"""
Represents an update to a \`JournalLine\`. Fields that are set will be updated.
"""
input JournalLinePatch {
  rowId: UUID
  journalEntryId: UUID
  accountId: UUID
  debit: BigFloat
  credit: BigFloat
  memo: String
}

"""All input for the \`updateJournalLine\` mutation."""
input UpdateJournalLineInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`JournalLine\` being updated.
  """
  patch: JournalLinePatch!
}

"""The output of our update \`SavingsGoal\` mutation."""
type UpdateSavingsGoalPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`SavingsGoal\` that was updated by this mutation."""
  savingsGoal: SavingsGoal

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`SavingsGoal\`. May be used by Relay 1."""
  savingsGoalEdge(
    """The method to use when ordering \`SavingsGoal\`."""
    orderBy: [SavingsGoalOrderBy!]! = [PRIMARY_KEY_ASC]
  ): SavingsGoalEdge
}

"""All input for the \`updateSavingsGoalById\` mutation."""
input UpdateSavingsGoalByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`SavingsGoal\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`SavingsGoal\` being updated.
  """
  patch: SavingsGoalPatch!
}

"""
Represents an update to a \`SavingsGoal\`. Fields that are set will be updated.
"""
input SavingsGoalPatch {
  rowId: UUID
  bookId: UUID
  accountId: UUID
  name: String
  targetAmount: BigFloat
  targetDate: Datetime
  createdAt: Datetime
  updatedAt: Datetime
}

"""All input for the \`updateSavingsGoal\` mutation."""
input UpdateSavingsGoalInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`SavingsGoal\` being updated.
  """
  patch: SavingsGoalPatch!
}

"""The output of our update \`NetWorthSnapshot\` mutation."""
type UpdateNetWorthSnapshotPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`NetWorthSnapshot\` that was updated by this mutation."""
  netWorthSnapshot: NetWorthSnapshot

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`NetWorthSnapshot\`. May be used by Relay 1."""
  netWorthSnapshotEdge(
    """The method to use when ordering \`NetWorthSnapshot\`."""
    orderBy: [NetWorthSnapshotOrderBy!]! = [PRIMARY_KEY_ASC]
  ): NetWorthSnapshotEdge
}

"""All input for the \`updateNetWorthSnapshotById\` mutation."""
input UpdateNetWorthSnapshotByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`NetWorthSnapshot\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`NetWorthSnapshot\` being updated.
  """
  patch: NetWorthSnapshotPatch!
}

"""
Represents an update to a \`NetWorthSnapshot\`. Fields that are set will be updated.
"""
input NetWorthSnapshotPatch {
  rowId: UUID
  bookId: UUID
  date: Datetime
  totalAssets: BigFloat
  totalLiabilities: BigFloat
  netWorth: BigFloat
  breakdown: String
  createdAt: Datetime
}

"""All input for the \`updateNetWorthSnapshot\` mutation."""
input UpdateNetWorthSnapshotInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`NetWorthSnapshot\` being updated.
  """
  patch: NetWorthSnapshotPatch!
}

"""The output of our update \`AccountingPeriod\` mutation."""
type UpdateAccountingPeriodPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`AccountingPeriod\` that was updated by this mutation."""
  accountingPeriod: AccountingPeriod

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`AccountingPeriod\`. May be used by Relay 1."""
  accountingPeriodEdge(
    """The method to use when ordering \`AccountingPeriod\`."""
    orderBy: [AccountingPeriodOrderBy!]! = [PRIMARY_KEY_ASC]
  ): AccountingPeriodEdge
}

"""All input for the \`updateAccountingPeriodById\` mutation."""
input UpdateAccountingPeriodByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`AccountingPeriod\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`AccountingPeriod\` being updated.
  """
  patch: AccountingPeriodPatch!
}

"""
Represents an update to a \`AccountingPeriod\`. Fields that are set will be updated.
"""
input AccountingPeriodPatch {
  rowId: UUID
  bookId: UUID
  year: Int
  month: Int
  status: String
  closedAt: Datetime
  closedBy: String
  reopenedAt: Datetime
  blockers: JSON
  createdAt: Datetime
}

"""All input for the \`updateAccountingPeriod\` mutation."""
input UpdateAccountingPeriodInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`AccountingPeriod\` being updated.
  """
  patch: AccountingPeriodPatch!
}

"""The output of our update \`CryptoLot\` mutation."""
type UpdateCryptoLotPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`CryptoLot\` that was updated by this mutation."""
  cryptoLot: CryptoLot

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`CryptoLot\`. May be used by Relay 1."""
  cryptoLotEdge(
    """The method to use when ordering \`CryptoLot\`."""
    orderBy: [CryptoLotOrderBy!]! = [PRIMARY_KEY_ASC]
  ): CryptoLotEdge
}

"""All input for the \`updateCryptoLotById\` mutation."""
input UpdateCryptoLotByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`CryptoLot\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`CryptoLot\` being updated.
  """
  patch: CryptoLotPatch!
}

"""
Represents an update to a \`CryptoLot\`. Fields that are set will be updated.
"""
input CryptoLotPatch {
  rowId: UUID
  cryptoAssetId: UUID
  acquiredAt: Datetime
  quantity: BigFloat
  costPerUnit: BigFloat
  remainingQuantity: BigFloat
  disposedAt: Datetime
  proceedsPerUnit: BigFloat
  journalEntryId: UUID
  createdAt: Datetime
}

"""All input for the \`updateCryptoLot\` mutation."""
input UpdateCryptoLotInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`CryptoLot\` being updated.
  """
  patch: CryptoLotPatch!
}

"""The output of our update \`Book\` mutation."""
type UpdateBookPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Book\` that was updated by this mutation."""
  book: Book

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Book\`. May be used by Relay 1."""
  bookEdge(
    """The method to use when ordering \`Book\`."""
    orderBy: [BookOrderBy!]! = [PRIMARY_KEY_ASC]
  ): BookEdge
}

"""All input for the \`updateBookById\` mutation."""
input UpdateBookByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`Book\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`Book\` being updated.
  """
  patch: BookPatch!
}

"""Represents an update to a \`Book\`. Fields that are set will be updated."""
input BookPatch {
  rowId: UUID
  organizationId: String
  name: String
  type: BookType
  currency: String
  fiscalYearStartMonth: Int
  createdAt: Datetime
  updatedAt: Datetime
}

"""All input for the \`updateBook\` mutation."""
input UpdateBookInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`Book\` being updated.
  """
  patch: BookPatch!
}

"""The output of our update \`Budget\` mutation."""
type UpdateBudgetPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Budget\` that was updated by this mutation."""
  budget: Budget

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Budget\`. May be used by Relay 1."""
  budgetEdge(
    """The method to use when ordering \`Budget\`."""
    orderBy: [BudgetOrderBy!]! = [PRIMARY_KEY_ASC]
  ): BudgetEdge
}

"""All input for the \`updateBudgetById\` mutation."""
input UpdateBudgetByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`Budget\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`Budget\` being updated.
  """
  patch: BudgetPatch!
}

"""
Represents an update to a \`Budget\`. Fields that are set will be updated.
"""
input BudgetPatch {
  rowId: UUID
  bookId: UUID
  accountId: UUID
  amount: BigFloat
  period: BudgetPeriod
  rollover: Boolean
  createdAt: Datetime
  updatedAt: Datetime
}

"""All input for the \`updateBudget\` mutation."""
input UpdateBudgetInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`Budget\` being updated.
  """
  patch: BudgetPatch!
}

"""The output of our update \`CryptoAsset\` mutation."""
type UpdateCryptoAssetPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`CryptoAsset\` that was updated by this mutation."""
  cryptoAsset: CryptoAsset

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`CryptoAsset\`. May be used by Relay 1."""
  cryptoAssetEdge(
    """The method to use when ordering \`CryptoAsset\`."""
    orderBy: [CryptoAssetOrderBy!]! = [PRIMARY_KEY_ASC]
  ): CryptoAssetEdge
}

"""All input for the \`updateCryptoAssetById\` mutation."""
input UpdateCryptoAssetByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`CryptoAsset\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`CryptoAsset\` being updated.
  """
  patch: CryptoAssetPatch!
}

"""
Represents an update to a \`CryptoAsset\`. Fields that are set will be updated.
"""
input CryptoAssetPatch {
  rowId: UUID
  bookId: UUID
  symbol: String
  name: String
  walletAddress: String
  network: String
  balance: BigFloat
  costBasisMethod: CostBasisMethod
  lastSyncedAt: Datetime
  createdAt: Datetime
  updatedAt: Datetime
}

"""All input for the \`updateCryptoAsset\` mutation."""
input UpdateCryptoAssetInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`CryptoAsset\` being updated.
  """
  patch: CryptoAssetPatch!
}

"""The output of our update \`CategorizationRule\` mutation."""
type UpdateCategorizationRulePayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`CategorizationRule\` that was updated by this mutation."""
  categorizationRule: CategorizationRule

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`CategorizationRule\`. May be used by Relay 1."""
  categorizationRuleEdge(
    """The method to use when ordering \`CategorizationRule\`."""
    orderBy: [CategorizationRuleOrderBy!]! = [PRIMARY_KEY_ASC]
  ): CategorizationRuleEdge
}

"""All input for the \`updateCategorizationRuleById\` mutation."""
input UpdateCategorizationRuleByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`CategorizationRule\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`CategorizationRule\` being updated.
  """
  patch: CategorizationRulePatch!
}

"""
Represents an update to a \`CategorizationRule\`. Fields that are set will be updated.
"""
input CategorizationRulePatch {
  rowId: UUID
  bookId: UUID
  name: String
  matchField: String
  matchType: String
  matchValue: String
  amountMin: BigFloat
  amountMax: BigFloat
  debitAccountId: UUID
  creditAccountId: UUID
  confidence: BigFloat
  priority: Int
  hitCount: Int
  lastHitAt: Datetime
  createdAt: Datetime
}

"""All input for the \`updateCategorizationRule\` mutation."""
input UpdateCategorizationRuleInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`CategorizationRule\` being updated.
  """
  patch: CategorizationRulePatch!
}

"""The output of our update \`JournalEntry\` mutation."""
type UpdateJournalEntryPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`JournalEntry\` that was updated by this mutation."""
  journalEntry: JournalEntry

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`JournalEntry\`. May be used by Relay 1."""
  journalEntryEdge(
    """The method to use when ordering \`JournalEntry\`."""
    orderBy: [JournalEntryOrderBy!]! = [PRIMARY_KEY_ASC]
  ): JournalEntryEdge
}

"""All input for the \`updateJournalEntryById\` mutation."""
input UpdateJournalEntryByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`JournalEntry\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`JournalEntry\` being updated.
  """
  patch: JournalEntryPatch!
}

"""
Represents an update to a \`JournalEntry\`. Fields that are set will be updated.
"""
input JournalEntryPatch {
  rowId: UUID
  bookId: UUID
  date: Datetime
  memo: String
  source: JournalEntrySource
  sourceReferenceId: String
  isReviewed: Boolean
  isReconciled: Boolean
  createdAt: Datetime
  updatedAt: Datetime
}

"""All input for the \`updateJournalEntry\` mutation."""
input UpdateJournalEntryInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`JournalEntry\` being updated.
  """
  patch: JournalEntryPatch!
}

"""The output of our update \`FixedAsset\` mutation."""
type UpdateFixedAssetPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`FixedAsset\` that was updated by this mutation."""
  fixedAsset: FixedAsset

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`FixedAsset\`. May be used by Relay 1."""
  fixedAssetEdge(
    """The method to use when ordering \`FixedAsset\`."""
    orderBy: [FixedAssetOrderBy!]! = [PRIMARY_KEY_ASC]
  ): FixedAssetEdge
}

"""All input for the \`updateFixedAssetById\` mutation."""
input UpdateFixedAssetByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`FixedAsset\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`FixedAsset\` being updated.
  """
  patch: FixedAssetPatch!
}

"""
Represents an update to a \`FixedAsset\`. Fields that are set will be updated.
"""
input FixedAssetPatch {
  rowId: UUID
  bookId: UUID
  name: String
  description: String
  assetAccountId: UUID
  depreciationExpenseAccountId: UUID
  accumulatedDepreciationAccountId: UUID
  acquisitionDate: String
  acquisitionCost: BigFloat
  salvageValue: BigFloat
  usefulLifeMonths: Int
  depreciationMethod: String
  macrsClass: String
  disposedAt: String
  disposalProceeds: BigFloat
  createdAt: Datetime
}

"""All input for the \`updateFixedAsset\` mutation."""
input UpdateFixedAssetInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`FixedAsset\` being updated.
  """
  patch: FixedAssetPatch!
}

"""The output of our update \`RecurringTransaction\` mutation."""
type UpdateRecurringTransactionPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`RecurringTransaction\` that was updated by this mutation."""
  recurringTransaction: RecurringTransaction

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`RecurringTransaction\`. May be used by Relay 1."""
  recurringTransactionEdge(
    """The method to use when ordering \`RecurringTransaction\`."""
    orderBy: [RecurringTransactionOrderBy!]! = [PRIMARY_KEY_ASC]
  ): RecurringTransactionEdge
}

"""All input for the \`updateRecurringTransactionById\` mutation."""
input UpdateRecurringTransactionByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`RecurringTransaction\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`RecurringTransaction\` being updated.
  """
  patch: RecurringTransactionPatch!
}

"""
Represents an update to a \`RecurringTransaction\`. Fields that are set will be updated.
"""
input RecurringTransactionPatch {
  rowId: UUID
  bookId: UUID
  name: String
  amount: BigFloat
  frequency: RecurringFrequency
  accountId: UUID
  counterAccountId: UUID
  isAutoDetected: Boolean
  isActive: Boolean
  nextExpectedDate: Datetime
  createdAt: Datetime
  updatedAt: Datetime
}

"""All input for the \`updateRecurringTransaction\` mutation."""
input UpdateRecurringTransactionInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`RecurringTransaction\` being updated.
  """
  patch: RecurringTransactionPatch!
}

"""The output of our update \`ReconciliationQueue\` mutation."""
type UpdateReconciliationQueuePayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`ReconciliationQueue\` that was updated by this mutation."""
  reconciliationQueue: ReconciliationQueue

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`ReconciliationQueue\`. May be used by Relay 1."""
  reconciliationQueueEdge(
    """The method to use when ordering \`ReconciliationQueue\`."""
    orderBy: [ReconciliationQueueOrderBy!]! = [PRIMARY_KEY_ASC]
  ): ReconciliationQueueEdge
}

"""All input for the \`updateReconciliationQueueById\` mutation."""
input UpdateReconciliationQueueByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`ReconciliationQueue\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`ReconciliationQueue\` being updated.
  """
  patch: ReconciliationQueuePatch!
}

"""
Represents an update to a \`ReconciliationQueue\`. Fields that are set will be updated.
"""
input ReconciliationQueuePatch {
  rowId: UUID
  bookId: UUID
  journalEntryId: UUID
  status: ReconciliationStatus
  reviewedAt: Datetime
  reviewedBy: String
  createdAt: Datetime
  categorizationSource: String
  confidence: BigFloat
  suggestedDebitAccountId: UUID
  suggestedCreditAccountId: UUID
  priority: Int
  periodYear: Int
  periodMonth: Int
}

"""All input for the \`updateReconciliationQueue\` mutation."""
input UpdateReconciliationQueueInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`ReconciliationQueue\` being updated.
  """
  patch: ReconciliationQueuePatch!
}

"""The output of our update \`Account\` mutation."""
type UpdateAccountPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Account\` that was updated by this mutation."""
  account: Account

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Account\`. May be used by Relay 1."""
  accountEdge(
    """The method to use when ordering \`Account\`."""
    orderBy: [AccountOrderBy!]! = [PRIMARY_KEY_ASC]
  ): AccountEdge
}

"""All input for the \`updateAccountById\` mutation."""
input UpdateAccountByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`Account\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`Account\` being updated.
  """
  patch: AccountPatch!
}

"""
Represents an update to a \`Account\`. Fields that are set will be updated.
"""
input AccountPatch {
  rowId: UUID
  bookId: UUID
  parentId: UUID
  name: String
  code: String
  type: AccountType
  subType: AccountSubType
  isPlaceholder: Boolean
  isActive: Boolean
  createdAt: Datetime
  updatedAt: Datetime
}

"""All input for the \`updateAccount\` mutation."""
input UpdateAccountInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`Account\` being updated.
  """
  patch: AccountPatch!
}

"""The output of our update \`ConnectedAccount\` mutation."""
type UpdateConnectedAccountPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`ConnectedAccount\` that was updated by this mutation."""
  connectedAccount: ConnectedAccount

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`ConnectedAccount\`. May be used by Relay 1."""
  connectedAccountEdge(
    """The method to use when ordering \`ConnectedAccount\`."""
    orderBy: [ConnectedAccountOrderBy!]! = [PRIMARY_KEY_ASC]
  ): ConnectedAccountEdge
}

"""All input for the \`updateConnectedAccountById\` mutation."""
input UpdateConnectedAccountByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`ConnectedAccount\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`ConnectedAccount\` being updated.
  """
  patch: ConnectedAccountPatch!
}

"""
Represents an update to a \`ConnectedAccount\`. Fields that are set will be updated.
"""
input ConnectedAccountPatch {
  rowId: UUID
  bookId: UUID
  provider: ConnectedAccountProvider
  providerAccountId: String
  accountId: UUID
  institutionName: String
  mask: String
  status: ConnectedAccountStatus
  accessToken: String
  lastSyncedAt: Datetime
  createdAt: Datetime
  syncCursor: String
}

"""All input for the \`updateConnectedAccount\` mutation."""
input UpdateConnectedAccountInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`ConnectedAccount\` being updated.
  """
  patch: ConnectedAccountPatch!
}

"""The output of our delete \`_DrizzleMigration\` mutation."""
type DeleteDrizzleMigrationPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`_DrizzleMigration\` that was deleted by this mutation."""
  _drizzleMigration: _DrizzleMigration
  deletedDrizzleMigrationId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`_DrizzleMigration\`. May be used by Relay 1."""
  _drizzleMigrationEdge(
    """The method to use when ordering \`_DrizzleMigration\`."""
    orderBy: [_DrizzleMigrationOrderBy!]! = [PRIMARY_KEY_ASC]
  ): _DrizzleMigrationEdge
}

"""All input for the \`deleteDrizzleMigrationById\` mutation."""
input DeleteDrizzleMigrationByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`_DrizzleMigration\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteDrizzleMigration\` mutation."""
input DeleteDrizzleMigrationInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: Int!
}

"""The output of our delete \`AccountMapping\` mutation."""
type DeleteAccountMappingPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`AccountMapping\` that was deleted by this mutation."""
  accountMapping: AccountMapping
  deletedAccountMappingId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`AccountMapping\`. May be used by Relay 1."""
  accountMappingEdge(
    """The method to use when ordering \`AccountMapping\`."""
    orderBy: [AccountMappingOrderBy!]! = [PRIMARY_KEY_ASC]
  ): AccountMappingEdge
}

"""All input for the \`deleteAccountMappingById\` mutation."""
input DeleteAccountMappingByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`AccountMapping\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteAccountMapping\` mutation."""
input DeleteAccountMappingInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`JournalLine\` mutation."""
type DeleteJournalLinePayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`JournalLine\` that was deleted by this mutation."""
  journalLine: JournalLine
  deletedJournalLineId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`JournalLine\`. May be used by Relay 1."""
  journalLineEdge(
    """The method to use when ordering \`JournalLine\`."""
    orderBy: [JournalLineOrderBy!]! = [PRIMARY_KEY_ASC]
  ): JournalLineEdge
}

"""All input for the \`deleteJournalLineById\` mutation."""
input DeleteJournalLineByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`JournalLine\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteJournalLine\` mutation."""
input DeleteJournalLineInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`SavingsGoal\` mutation."""
type DeleteSavingsGoalPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`SavingsGoal\` that was deleted by this mutation."""
  savingsGoal: SavingsGoal
  deletedSavingsGoalId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`SavingsGoal\`. May be used by Relay 1."""
  savingsGoalEdge(
    """The method to use when ordering \`SavingsGoal\`."""
    orderBy: [SavingsGoalOrderBy!]! = [PRIMARY_KEY_ASC]
  ): SavingsGoalEdge
}

"""All input for the \`deleteSavingsGoalById\` mutation."""
input DeleteSavingsGoalByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`SavingsGoal\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteSavingsGoal\` mutation."""
input DeleteSavingsGoalInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`NetWorthSnapshot\` mutation."""
type DeleteNetWorthSnapshotPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`NetWorthSnapshot\` that was deleted by this mutation."""
  netWorthSnapshot: NetWorthSnapshot
  deletedNetWorthSnapshotId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`NetWorthSnapshot\`. May be used by Relay 1."""
  netWorthSnapshotEdge(
    """The method to use when ordering \`NetWorthSnapshot\`."""
    orderBy: [NetWorthSnapshotOrderBy!]! = [PRIMARY_KEY_ASC]
  ): NetWorthSnapshotEdge
}

"""All input for the \`deleteNetWorthSnapshotById\` mutation."""
input DeleteNetWorthSnapshotByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`NetWorthSnapshot\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteNetWorthSnapshot\` mutation."""
input DeleteNetWorthSnapshotInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`AccountingPeriod\` mutation."""
type DeleteAccountingPeriodPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`AccountingPeriod\` that was deleted by this mutation."""
  accountingPeriod: AccountingPeriod
  deletedAccountingPeriodId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`AccountingPeriod\`. May be used by Relay 1."""
  accountingPeriodEdge(
    """The method to use when ordering \`AccountingPeriod\`."""
    orderBy: [AccountingPeriodOrderBy!]! = [PRIMARY_KEY_ASC]
  ): AccountingPeriodEdge
}

"""All input for the \`deleteAccountingPeriodById\` mutation."""
input DeleteAccountingPeriodByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`AccountingPeriod\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteAccountingPeriod\` mutation."""
input DeleteAccountingPeriodInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`CryptoLot\` mutation."""
type DeleteCryptoLotPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`CryptoLot\` that was deleted by this mutation."""
  cryptoLot: CryptoLot
  deletedCryptoLotId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`CryptoLot\`. May be used by Relay 1."""
  cryptoLotEdge(
    """The method to use when ordering \`CryptoLot\`."""
    orderBy: [CryptoLotOrderBy!]! = [PRIMARY_KEY_ASC]
  ): CryptoLotEdge
}

"""All input for the \`deleteCryptoLotById\` mutation."""
input DeleteCryptoLotByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`CryptoLot\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteCryptoLot\` mutation."""
input DeleteCryptoLotInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`Book\` mutation."""
type DeleteBookPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Book\` that was deleted by this mutation."""
  book: Book
  deletedBookId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Book\`. May be used by Relay 1."""
  bookEdge(
    """The method to use when ordering \`Book\`."""
    orderBy: [BookOrderBy!]! = [PRIMARY_KEY_ASC]
  ): BookEdge
}

"""All input for the \`deleteBookById\` mutation."""
input DeleteBookByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`Book\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteBook\` mutation."""
input DeleteBookInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`Budget\` mutation."""
type DeleteBudgetPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Budget\` that was deleted by this mutation."""
  budget: Budget
  deletedBudgetId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Budget\`. May be used by Relay 1."""
  budgetEdge(
    """The method to use when ordering \`Budget\`."""
    orderBy: [BudgetOrderBy!]! = [PRIMARY_KEY_ASC]
  ): BudgetEdge
}

"""All input for the \`deleteBudgetById\` mutation."""
input DeleteBudgetByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`Budget\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteBudget\` mutation."""
input DeleteBudgetInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`CryptoAsset\` mutation."""
type DeleteCryptoAssetPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`CryptoAsset\` that was deleted by this mutation."""
  cryptoAsset: CryptoAsset
  deletedCryptoAssetId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`CryptoAsset\`. May be used by Relay 1."""
  cryptoAssetEdge(
    """The method to use when ordering \`CryptoAsset\`."""
    orderBy: [CryptoAssetOrderBy!]! = [PRIMARY_KEY_ASC]
  ): CryptoAssetEdge
}

"""All input for the \`deleteCryptoAssetById\` mutation."""
input DeleteCryptoAssetByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`CryptoAsset\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteCryptoAsset\` mutation."""
input DeleteCryptoAssetInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`CategorizationRule\` mutation."""
type DeleteCategorizationRulePayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`CategorizationRule\` that was deleted by this mutation."""
  categorizationRule: CategorizationRule
  deletedCategorizationRuleId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`CategorizationRule\`. May be used by Relay 1."""
  categorizationRuleEdge(
    """The method to use when ordering \`CategorizationRule\`."""
    orderBy: [CategorizationRuleOrderBy!]! = [PRIMARY_KEY_ASC]
  ): CategorizationRuleEdge
}

"""All input for the \`deleteCategorizationRuleById\` mutation."""
input DeleteCategorizationRuleByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`CategorizationRule\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteCategorizationRule\` mutation."""
input DeleteCategorizationRuleInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`JournalEntry\` mutation."""
type DeleteJournalEntryPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`JournalEntry\` that was deleted by this mutation."""
  journalEntry: JournalEntry
  deletedJournalEntryId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`JournalEntry\`. May be used by Relay 1."""
  journalEntryEdge(
    """The method to use when ordering \`JournalEntry\`."""
    orderBy: [JournalEntryOrderBy!]! = [PRIMARY_KEY_ASC]
  ): JournalEntryEdge
}

"""All input for the \`deleteJournalEntryById\` mutation."""
input DeleteJournalEntryByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`JournalEntry\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteJournalEntry\` mutation."""
input DeleteJournalEntryInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`FixedAsset\` mutation."""
type DeleteFixedAssetPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`FixedAsset\` that was deleted by this mutation."""
  fixedAsset: FixedAsset
  deletedFixedAssetId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`FixedAsset\`. May be used by Relay 1."""
  fixedAssetEdge(
    """The method to use when ordering \`FixedAsset\`."""
    orderBy: [FixedAssetOrderBy!]! = [PRIMARY_KEY_ASC]
  ): FixedAssetEdge
}

"""All input for the \`deleteFixedAssetById\` mutation."""
input DeleteFixedAssetByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`FixedAsset\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteFixedAsset\` mutation."""
input DeleteFixedAssetInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`RecurringTransaction\` mutation."""
type DeleteRecurringTransactionPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`RecurringTransaction\` that was deleted by this mutation."""
  recurringTransaction: RecurringTransaction
  deletedRecurringTransactionId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`RecurringTransaction\`. May be used by Relay 1."""
  recurringTransactionEdge(
    """The method to use when ordering \`RecurringTransaction\`."""
    orderBy: [RecurringTransactionOrderBy!]! = [PRIMARY_KEY_ASC]
  ): RecurringTransactionEdge
}

"""All input for the \`deleteRecurringTransactionById\` mutation."""
input DeleteRecurringTransactionByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`RecurringTransaction\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteRecurringTransaction\` mutation."""
input DeleteRecurringTransactionInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`ReconciliationQueue\` mutation."""
type DeleteReconciliationQueuePayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`ReconciliationQueue\` that was deleted by this mutation."""
  reconciliationQueue: ReconciliationQueue
  deletedReconciliationQueueId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`ReconciliationQueue\`. May be used by Relay 1."""
  reconciliationQueueEdge(
    """The method to use when ordering \`ReconciliationQueue\`."""
    orderBy: [ReconciliationQueueOrderBy!]! = [PRIMARY_KEY_ASC]
  ): ReconciliationQueueEdge
}

"""All input for the \`deleteReconciliationQueueById\` mutation."""
input DeleteReconciliationQueueByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`ReconciliationQueue\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteReconciliationQueue\` mutation."""
input DeleteReconciliationQueueInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`Account\` mutation."""
type DeleteAccountPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Account\` that was deleted by this mutation."""
  account: Account
  deletedAccountId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Account\`. May be used by Relay 1."""
  accountEdge(
    """The method to use when ordering \`Account\`."""
    orderBy: [AccountOrderBy!]! = [PRIMARY_KEY_ASC]
  ): AccountEdge
}

"""All input for the \`deleteAccountById\` mutation."""
input DeleteAccountByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`Account\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteAccount\` mutation."""
input DeleteAccountInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`ConnectedAccount\` mutation."""
type DeleteConnectedAccountPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`ConnectedAccount\` that was deleted by this mutation."""
  connectedAccount: ConnectedAccount
  deletedConnectedAccountId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`ConnectedAccount\`. May be used by Relay 1."""
  connectedAccountEdge(
    """The method to use when ordering \`ConnectedAccount\`."""
    orderBy: [ConnectedAccountOrderBy!]! = [PRIMARY_KEY_ASC]
  ): ConnectedAccountEdge
}

"""All input for the \`deleteConnectedAccountById\` mutation."""
input DeleteConnectedAccountByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`ConnectedAccount\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteConnectedAccount\` mutation."""
input DeleteConnectedAccountInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}`;
export const objects = {
  Query: {
    assertStep() {
      return !0;
    },
    plans: {
      _drizzleMigration(_$root, {
        $rowId
      }) {
        return resource___drizzle_migrationsPgResource.get({
          id: $rowId
        });
      },
      _drizzleMigrationById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher__DrizzleMigration($nodeId);
      },
      _drizzleMigrations: {
        plan() {
          return connection(resource___drizzle_migrationsPgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      account(_$root, {
        $rowId
      }) {
        return resource_accountPgResource.get({
          id: $rowId
        });
      },
      accountById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_Account($nodeId);
      },
      accountingPeriod(_$root, {
        $rowId
      }) {
        return resource_accounting_periodPgResource.get({
          id: $rowId
        });
      },
      accountingPeriodById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_AccountingPeriod($nodeId);
      },
      accountingPeriods: {
        plan() {
          return connection(resource_accounting_periodPgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      accountMapping(_$root, {
        $rowId
      }) {
        return resource_account_mappingPgResource.get({
          id: $rowId
        });
      },
      accountMappingById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_AccountMapping($nodeId);
      },
      accountMappings: {
        plan() {
          return connection(resource_account_mappingPgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      accounts: {
        plan() {
          return connection(resource_accountPgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      book(_$root, {
        $rowId
      }) {
        return resource_bookPgResource.get({
          id: $rowId
        });
      },
      bookById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_Book($nodeId);
      },
      books: {
        plan() {
          return connection(resource_bookPgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      budget(_$root, {
        $rowId
      }) {
        return resource_budgetPgResource.get({
          id: $rowId
        });
      },
      budgetById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_Budget($nodeId);
      },
      budgets: {
        plan() {
          return connection(resource_budgetPgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      categorizationRule(_$root, {
        $rowId
      }) {
        return resource_categorization_rulePgResource.get({
          id: $rowId
        });
      },
      categorizationRuleById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_CategorizationRule($nodeId);
      },
      categorizationRules: {
        plan() {
          return connection(resource_categorization_rulePgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      connectedAccount(_$root, {
        $rowId
      }) {
        return resource_connected_accountPgResource.get({
          id: $rowId
        });
      },
      connectedAccountById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_ConnectedAccount($nodeId);
      },
      connectedAccounts: {
        plan() {
          return connection(resource_connected_accountPgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      cryptoAsset(_$root, {
        $rowId
      }) {
        return resource_crypto_assetPgResource.get({
          id: $rowId
        });
      },
      cryptoAssetById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_CryptoAsset($nodeId);
      },
      cryptoAssets: {
        plan() {
          return connection(resource_crypto_assetPgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      cryptoLot(_$root, {
        $rowId
      }) {
        return resource_crypto_lotPgResource.get({
          id: $rowId
        });
      },
      cryptoLotById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_CryptoLot($nodeId);
      },
      cryptoLots: {
        plan() {
          return connection(resource_crypto_lotPgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      fixedAsset(_$root, {
        $rowId
      }) {
        return resource_fixed_assetPgResource.get({
          id: $rowId
        });
      },
      fixedAssetById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_FixedAsset($nodeId);
      },
      fixedAssets: {
        plan() {
          return connection(resource_fixed_assetPgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      id($parent) {
        const specifier = nodeIdHandler_Query.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_Query.codec.name].encode);
      },
      journalEntries: {
        plan() {
          return connection(resource_journal_entryPgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      journalEntry(_$root, {
        $rowId
      }) {
        return resource_journal_entryPgResource.get({
          id: $rowId
        });
      },
      journalEntryById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_JournalEntry($nodeId);
      },
      journalLine(_$root, {
        $rowId
      }) {
        return resource_journal_linePgResource.get({
          id: $rowId
        });
      },
      journalLineById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_JournalLine($nodeId);
      },
      journalLines: {
        plan() {
          return connection(resource_journal_linePgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      netWorthSnapshot(_$root, {
        $rowId
      }) {
        return resource_net_worth_snapshotPgResource.get({
          id: $rowId
        });
      },
      netWorthSnapshotById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_NetWorthSnapshot($nodeId);
      },
      netWorthSnapshots: {
        plan() {
          return connection(resource_net_worth_snapshotPgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      node(_$root, fieldArgs) {
        return fieldArgs.getRaw("id");
      },
      query() {
        return rootValue();
      },
      reconciliationQueue(_$root, {
        $rowId
      }) {
        return resource_reconciliation_queuePgResource.get({
          id: $rowId
        });
      },
      reconciliationQueueById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_ReconciliationQueue($nodeId);
      },
      reconciliationQueues: {
        plan() {
          return connection(resource_reconciliation_queuePgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      recurringTransaction(_$root, {
        $rowId
      }) {
        return resource_recurring_transactionPgResource.get({
          id: $rowId
        });
      },
      recurringTransactionById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_RecurringTransaction($nodeId);
      },
      recurringTransactions: {
        plan() {
          return connection(resource_recurring_transactionPgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      savingsGoal(_$root, {
        $rowId
      }) {
        return resource_savings_goalPgResource.get({
          id: $rowId
        });
      },
      savingsGoalById(_$parent, args) {
        const $nodeId = args.getRaw("id");
        return nodeFetcher_SavingsGoal($nodeId);
      },
      savingsGoals: {
        plan() {
          return connection(resource_savings_goalPgResource.find());
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      }
    }
  },
  Mutation: {
    assertStep: __ValueStep,
    plans: {
      createAccount: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_accountPgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createAccountingPeriod: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_accounting_periodPgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createAccountMapping: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_account_mappingPgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createBook: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_bookPgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createBudget: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_budgetPgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createCategorizationRule: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_categorization_rulePgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createConnectedAccount: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_connected_accountPgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createCryptoAsset: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_crypto_assetPgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createCryptoLot: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_crypto_lotPgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createDrizzleMigration: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource___drizzle_migrationsPgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createFixedAsset: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_fixed_assetPgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createJournalEntry: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_journal_entryPgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createJournalLine: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_journal_linePgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createNetWorthSnapshot: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_net_worth_snapshotPgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createReconciliationQueue: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_reconciliation_queuePgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createRecurringTransaction: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_recurring_transactionPgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      createSavingsGoal: {
        plan(_, args) {
          const $insert = pgInsertSingle(resource_savings_goalPgResource);
          args.apply($insert);
          return object({
            result: $insert
          });
        },
        args: {
          input: applyInputToInsert
        }
      },
      deleteAccount: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_accountPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteAccountById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_accountPgResource, specFromArgs_Account(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteAccountingPeriod: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_accounting_periodPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteAccountingPeriodById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_accounting_periodPgResource, specFromArgs_AccountingPeriod(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteAccountMapping: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_account_mappingPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteAccountMappingById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_account_mappingPgResource, specFromArgs_AccountMapping(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteBook: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_bookPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteBookById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_bookPgResource, specFromArgs_Book(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteBudget: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_budgetPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteBudgetById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_budgetPgResource, specFromArgs_Budget(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteCategorizationRule: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_categorization_rulePgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteCategorizationRuleById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_categorization_rulePgResource, specFromArgs_CategorizationRule(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteConnectedAccount: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_connected_accountPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteConnectedAccountById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_connected_accountPgResource, specFromArgs_ConnectedAccount(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteCryptoAsset: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_crypto_assetPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteCryptoAssetById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_crypto_assetPgResource, specFromArgs_CryptoAsset(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteCryptoLot: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_crypto_lotPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteCryptoLotById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_crypto_lotPgResource, specFromArgs_CryptoLot(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteDrizzleMigration: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource___drizzle_migrationsPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteDrizzleMigrationById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource___drizzle_migrationsPgResource, specFromArgs__DrizzleMigration(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteFixedAsset: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_fixed_assetPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteFixedAssetById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_fixed_assetPgResource, specFromArgs_FixedAsset(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteJournalEntry: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_journal_entryPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteJournalEntryById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_journal_entryPgResource, specFromArgs_JournalEntry(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteJournalLine: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_journal_linePgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteJournalLineById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_journal_linePgResource, specFromArgs_JournalLine(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteNetWorthSnapshot: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_net_worth_snapshotPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteNetWorthSnapshotById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_net_worth_snapshotPgResource, specFromArgs_NetWorthSnapshot(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteReconciliationQueue: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_reconciliation_queuePgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteReconciliationQueueById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_reconciliation_queuePgResource, specFromArgs_ReconciliationQueue(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteRecurringTransaction: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_recurring_transactionPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteRecurringTransactionById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_recurring_transactionPgResource, specFromArgs_RecurringTransaction(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteSavingsGoal: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_savings_goalPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      deleteSavingsGoalById: {
        plan(_$root, args) {
          const $delete = pgDeleteSingle(resource_savings_goalPgResource, specFromArgs_SavingsGoal(args));
          args.apply($delete);
          return object({
            result: $delete
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateAccount: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_accountPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateAccountById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_accountPgResource, specFromArgs_Account(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateAccountingPeriod: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_accounting_periodPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateAccountingPeriodById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_accounting_periodPgResource, specFromArgs_AccountingPeriod(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateAccountMapping: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_account_mappingPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateAccountMappingById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_account_mappingPgResource, specFromArgs_AccountMapping(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateBook: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_bookPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateBookById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_bookPgResource, specFromArgs_Book(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateBudget: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_budgetPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateBudgetById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_budgetPgResource, specFromArgs_Budget(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateCategorizationRule: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_categorization_rulePgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateCategorizationRuleById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_categorization_rulePgResource, specFromArgs_CategorizationRule(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateConnectedAccount: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_connected_accountPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateConnectedAccountById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_connected_accountPgResource, specFromArgs_ConnectedAccount(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateCryptoAsset: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_crypto_assetPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateCryptoAssetById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_crypto_assetPgResource, specFromArgs_CryptoAsset(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateCryptoLot: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_crypto_lotPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateCryptoLotById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_crypto_lotPgResource, specFromArgs_CryptoLot(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateDrizzleMigration: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource___drizzle_migrationsPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateDrizzleMigrationById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource___drizzle_migrationsPgResource, specFromArgs__DrizzleMigration(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateFixedAsset: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_fixed_assetPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateFixedAssetById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_fixed_assetPgResource, specFromArgs_FixedAsset(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateJournalEntry: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_journal_entryPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateJournalEntryById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_journal_entryPgResource, specFromArgs_JournalEntry(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateJournalLine: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_journal_linePgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateJournalLineById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_journal_linePgResource, specFromArgs_JournalLine(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateNetWorthSnapshot: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_net_worth_snapshotPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateNetWorthSnapshotById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_net_worth_snapshotPgResource, specFromArgs_NetWorthSnapshot(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateReconciliationQueue: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_reconciliation_queuePgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateReconciliationQueueById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_reconciliation_queuePgResource, specFromArgs_ReconciliationQueue(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateRecurringTransaction: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_recurring_transactionPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateRecurringTransactionById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_recurring_transactionPgResource, specFromArgs_RecurringTransaction(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateSavingsGoal: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_savings_goalPgResource, {
            id: args.getRaw(['input', "rowId"])
          });
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      },
      updateSavingsGoalById: {
        plan(_$root, args) {
          const $update = pgUpdateSingle(resource_savings_goalPgResource, specFromArgs_SavingsGoal(args));
          args.apply($update);
          return object({
            result: $update
          });
        },
        args: {
          input: applyInputToUpdateOrDelete
        }
      }
    }
  },
  _DrizzleMigration: {
    assertStep: assertPgClassSingleStep,
    plans: {
      createdAt: _DrizzleMigration_createdAtPlan,
      id($parent) {
        const specifier = nodeIdHandler__DrizzleMigration.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler__DrizzleMigration.codec.name].encode);
      },
      rowId: _DrizzleMigration_rowIdPlan
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of __drizzle_migrationsUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource___drizzle_migrationsPgResource.get(spec);
    }
  },
  _DrizzleMigrationConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  Account: {
    assertStep: assertPgClassSingleStep,
    plans: {
      book: AccountMapping_bookPlan,
      bookId: AccountMapping_bookIdPlan,
      budgets: {
        plan($record) {
          const $records = resource_budgetPgResource.find({
            account_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      childAccounts: {
        plan($record) {
          const $records = resource_accountPgResource.find({
            parent_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      createdAt: _DrizzleMigration_createdAtPlan,
      id($parent) {
        const specifier = nodeIdHandler_Account.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_Account.codec.name].encode);
      },
      isActive: Account_isActivePlan,
      isPlaceholder($record) {
        return $record.get("is_placeholder");
      },
      journalLines: {
        plan($record) {
          const $records = resource_journal_linePgResource.find({
            account_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      parent($record) {
        return resource_accountPgResource.get({
          id: $record.get("parent_id")
        });
      },
      parentId($record) {
        return $record.get("parent_id");
      },
      rowId: _DrizzleMigration_rowIdPlan,
      subType($record) {
        return $record.get("sub_type");
      },
      updatedAt: AccountMapping_updatedAtPlan
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of accountUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_accountPgResource.get(spec);
    }
  },
  AccountConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  AccountingPeriod: {
    assertStep: assertPgClassSingleStep,
    plans: {
      book: AccountMapping_bookPlan,
      bookId: AccountMapping_bookIdPlan,
      closedAt($record) {
        return $record.get("closed_at");
      },
      closedBy($record) {
        return $record.get("closed_by");
      },
      createdAt: _DrizzleMigration_createdAtPlan,
      id($parent) {
        const specifier = nodeIdHandler_AccountingPeriod.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_AccountingPeriod.codec.name].encode);
      },
      reopenedAt($record) {
        return $record.get("reopened_at");
      },
      rowId: _DrizzleMigration_rowIdPlan
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of accounting_periodUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_accounting_periodPgResource.get(spec);
    }
  },
  AccountingPeriodConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  AccountMapping: {
    assertStep: assertPgClassSingleStep,
    plans: {
      book: AccountMapping_bookPlan,
      bookId: AccountMapping_bookIdPlan,
      createdAt: _DrizzleMigration_createdAtPlan,
      creditAccount: AccountMapping_creditAccountPlan,
      creditAccountId: AccountMapping_creditAccountIdPlan,
      debitAccount: AccountMapping_debitAccountPlan,
      debitAccountId: AccountMapping_debitAccountIdPlan,
      eventType($record) {
        return $record.get("event_type");
      },
      id($parent) {
        const specifier = nodeIdHandler_AccountMapping.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_AccountMapping.codec.name].encode);
      },
      rowId: _DrizzleMigration_rowIdPlan,
      updatedAt: AccountMapping_updatedAtPlan
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of account_mappingUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_account_mappingPgResource.get(spec);
    }
  },
  AccountMappingConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  Book: {
    assertStep: assertPgClassSingleStep,
    plans: {
      accountingPeriods: {
        plan($record) {
          const $records = resource_accounting_periodPgResource.find({
            book_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      accountMappings: {
        plan($record) {
          const $records = resource_account_mappingPgResource.find({
            book_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      accounts: {
        plan($record) {
          const $records = resource_accountPgResource.find({
            book_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      budgets: {
        plan($record) {
          const $records = resource_budgetPgResource.find({
            book_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      categorizationRules: {
        plan($record) {
          const $records = resource_categorization_rulePgResource.find({
            book_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      connectedAccounts: {
        plan($record) {
          const $records = resource_connected_accountPgResource.find({
            book_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      createdAt: _DrizzleMigration_createdAtPlan,
      cryptoAssets: {
        plan($record) {
          const $records = resource_crypto_assetPgResource.find({
            book_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      fiscalYearStartMonth($record) {
        return $record.get("fiscal_year_start_month");
      },
      fixedAssets: {
        plan($record) {
          const $records = resource_fixed_assetPgResource.find({
            book_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      id($parent) {
        const specifier = nodeIdHandler_Book.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_Book.codec.name].encode);
      },
      journalEntries: {
        plan($record) {
          const $records = resource_journal_entryPgResource.find({
            book_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      netWorthSnapshots: {
        plan($record) {
          const $records = resource_net_worth_snapshotPgResource.find({
            book_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      organizationId($record) {
        return $record.get("organization_id");
      },
      reconciliationQueues: {
        plan($record) {
          const $records = resource_reconciliation_queuePgResource.find({
            book_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      recurringTransactions: {
        plan($record) {
          const $records = resource_recurring_transactionPgResource.find({
            book_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      rowId: _DrizzleMigration_rowIdPlan,
      savingsGoals: {
        plan($record) {
          const $records = resource_savings_goalPgResource.find({
            book_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      updatedAt: AccountMapping_updatedAtPlan
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of bookUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_bookPgResource.get(spec);
    }
  },
  BookConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  Budget: {
    assertStep: assertPgClassSingleStep,
    plans: {
      account: Budget_accountPlan,
      accountId: Budget_accountIdPlan,
      book: AccountMapping_bookPlan,
      bookId: AccountMapping_bookIdPlan,
      createdAt: _DrizzleMigration_createdAtPlan,
      id($parent) {
        const specifier = nodeIdHandler_Budget.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_Budget.codec.name].encode);
      },
      rowId: _DrizzleMigration_rowIdPlan,
      updatedAt: AccountMapping_updatedAtPlan
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of budgetUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_budgetPgResource.get(spec);
    }
  },
  BudgetConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  CategorizationRule: {
    assertStep: assertPgClassSingleStep,
    plans: {
      amountMax($record) {
        return $record.get("amount_max");
      },
      amountMin($record) {
        return $record.get("amount_min");
      },
      book: AccountMapping_bookPlan,
      bookId: AccountMapping_bookIdPlan,
      createdAt: _DrizzleMigration_createdAtPlan,
      creditAccount: AccountMapping_creditAccountPlan,
      creditAccountId: AccountMapping_creditAccountIdPlan,
      debitAccount: AccountMapping_debitAccountPlan,
      debitAccountId: AccountMapping_debitAccountIdPlan,
      hitCount($record) {
        return $record.get("hit_count");
      },
      id($parent) {
        const specifier = nodeIdHandler_CategorizationRule.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_CategorizationRule.codec.name].encode);
      },
      lastHitAt($record) {
        return $record.get("last_hit_at");
      },
      matchField($record) {
        return $record.get("match_field");
      },
      matchType($record) {
        return $record.get("match_type");
      },
      matchValue($record) {
        return $record.get("match_value");
      },
      rowId: _DrizzleMigration_rowIdPlan
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of categorization_ruleUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_categorization_rulePgResource.get(spec);
    }
  },
  CategorizationRuleConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  ConnectedAccount: {
    assertStep: assertPgClassSingleStep,
    plans: {
      accessToken($record) {
        return $record.get("access_token");
      },
      account: Budget_accountPlan,
      accountId: Budget_accountIdPlan,
      book: AccountMapping_bookPlan,
      bookId: AccountMapping_bookIdPlan,
      createdAt: _DrizzleMigration_createdAtPlan,
      id($parent) {
        const specifier = nodeIdHandler_ConnectedAccount.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_ConnectedAccount.codec.name].encode);
      },
      institutionName($record) {
        return $record.get("institution_name");
      },
      lastSyncedAt: ConnectedAccount_lastSyncedAtPlan,
      providerAccountId($record) {
        return $record.get("provider_account_id");
      },
      rowId: _DrizzleMigration_rowIdPlan,
      syncCursor($record) {
        return $record.get("sync_cursor");
      }
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of connected_accountUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_connected_accountPgResource.get(spec);
    }
  },
  ConnectedAccountConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  CreateAccountingPeriodPayload: {
    assertStep: assertStep,
    plans: {
      accountingPeriod: planCreatePayloadResult,
      accountingPeriodEdge: CreateAccountingPeriodPayload_accountingPeriodEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan
    }
  },
  CreateAccountMappingPayload: {
    assertStep: assertStep,
    plans: {
      accountMapping: planCreatePayloadResult,
      accountMappingEdge: CreateAccountMappingPayload_accountMappingEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan
    }
  },
  CreateAccountPayload: {
    assertStep: assertStep,
    plans: {
      account: planCreatePayloadResult,
      accountEdge: CreateAccountPayload_accountEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan
    }
  },
  CreateBookPayload: {
    assertStep: assertStep,
    plans: {
      book: planCreatePayloadResult,
      bookEdge: CreateBookPayload_bookEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan
    }
  },
  CreateBudgetPayload: {
    assertStep: assertStep,
    plans: {
      budget: planCreatePayloadResult,
      budgetEdge: CreateBudgetPayload_budgetEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan
    }
  },
  CreateCategorizationRulePayload: {
    assertStep: assertStep,
    plans: {
      categorizationRule: planCreatePayloadResult,
      categorizationRuleEdge: CreateCategorizationRulePayload_categorizationRuleEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan
    }
  },
  CreateConnectedAccountPayload: {
    assertStep: assertStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      connectedAccount: planCreatePayloadResult,
      connectedAccountEdge: CreateConnectedAccountPayload_connectedAccountEdgePlan,
      query: queryPlan
    }
  },
  CreateCryptoAssetPayload: {
    assertStep: assertStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      cryptoAsset: planCreatePayloadResult,
      cryptoAssetEdge: CreateCryptoAssetPayload_cryptoAssetEdgePlan,
      query: queryPlan
    }
  },
  CreateCryptoLotPayload: {
    assertStep: assertStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      cryptoLot: planCreatePayloadResult,
      cryptoLotEdge: CreateCryptoLotPayload_cryptoLotEdgePlan,
      query: queryPlan
    }
  },
  CreateDrizzleMigrationPayload: {
    assertStep: assertStep,
    plans: {
      _drizzleMigration: planCreatePayloadResult,
      _drizzleMigrationEdge: CreateDrizzleMigrationPayload__drizzleMigrationEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan
    }
  },
  CreateFixedAssetPayload: {
    assertStep: assertStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      fixedAsset: planCreatePayloadResult,
      fixedAssetEdge: CreateFixedAssetPayload_fixedAssetEdgePlan,
      query: queryPlan
    }
  },
  CreateJournalEntryPayload: {
    assertStep: assertStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      journalEntry: planCreatePayloadResult,
      journalEntryEdge: CreateJournalEntryPayload_journalEntryEdgePlan,
      query: queryPlan
    }
  },
  CreateJournalLinePayload: {
    assertStep: assertStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      journalLine: planCreatePayloadResult,
      journalLineEdge: CreateJournalLinePayload_journalLineEdgePlan,
      query: queryPlan
    }
  },
  CreateNetWorthSnapshotPayload: {
    assertStep: assertStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      netWorthSnapshot: planCreatePayloadResult,
      netWorthSnapshotEdge: CreateNetWorthSnapshotPayload_netWorthSnapshotEdgePlan,
      query: queryPlan
    }
  },
  CreateReconciliationQueuePayload: {
    assertStep: assertStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan,
      reconciliationQueue: planCreatePayloadResult,
      reconciliationQueueEdge: CreateReconciliationQueuePayload_reconciliationQueueEdgePlan
    }
  },
  CreateRecurringTransactionPayload: {
    assertStep: assertStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan,
      recurringTransaction: planCreatePayloadResult,
      recurringTransactionEdge: CreateRecurringTransactionPayload_recurringTransactionEdgePlan
    }
  },
  CreateSavingsGoalPayload: {
    assertStep: assertStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan,
      savingsGoal: planCreatePayloadResult,
      savingsGoalEdge: CreateSavingsGoalPayload_savingsGoalEdgePlan
    }
  },
  CryptoAsset: {
    assertStep: assertPgClassSingleStep,
    plans: {
      book: AccountMapping_bookPlan,
      bookId: AccountMapping_bookIdPlan,
      costBasisMethod($record) {
        return $record.get("cost_basis_method");
      },
      createdAt: _DrizzleMigration_createdAtPlan,
      cryptoLots: {
        plan($record) {
          const $records = resource_crypto_lotPgResource.find({
            crypto_asset_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      id($parent) {
        const specifier = nodeIdHandler_CryptoAsset.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_CryptoAsset.codec.name].encode);
      },
      lastSyncedAt: ConnectedAccount_lastSyncedAtPlan,
      rowId: _DrizzleMigration_rowIdPlan,
      updatedAt: AccountMapping_updatedAtPlan,
      walletAddress($record) {
        return $record.get("wallet_address");
      }
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of crypto_assetUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_crypto_assetPgResource.get(spec);
    }
  },
  CryptoAssetConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  CryptoLot: {
    assertStep: assertPgClassSingleStep,
    plans: {
      acquiredAt($record) {
        return $record.get("acquired_at");
      },
      costPerUnit($record) {
        return $record.get("cost_per_unit");
      },
      createdAt: _DrizzleMigration_createdAtPlan,
      cryptoAsset($record) {
        return resource_crypto_assetPgResource.get({
          id: $record.get("crypto_asset_id")
        });
      },
      cryptoAssetId($record) {
        return $record.get("crypto_asset_id");
      },
      disposedAt: CryptoLot_disposedAtPlan,
      id($parent) {
        const specifier = nodeIdHandler_CryptoLot.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_CryptoLot.codec.name].encode);
      },
      journalEntry: JournalLine_journalEntryPlan,
      journalEntryId: JournalLine_journalEntryIdPlan,
      proceedsPerUnit($record) {
        return $record.get("proceeds_per_unit");
      },
      remainingQuantity($record) {
        return $record.get("remaining_quantity");
      },
      rowId: _DrizzleMigration_rowIdPlan
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of crypto_lotUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_crypto_lotPgResource.get(spec);
    }
  },
  CryptoLotConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  DeleteAccountingPeriodPayload: {
    assertStep: ObjectStep,
    plans: {
      accountingPeriod: planCreatePayloadResult,
      accountingPeriodEdge: CreateAccountingPeriodPayload_accountingPeriodEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      deletedAccountingPeriodId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_AccountingPeriod.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      query: queryPlan
    }
  },
  DeleteAccountMappingPayload: {
    assertStep: ObjectStep,
    plans: {
      accountMapping: planCreatePayloadResult,
      accountMappingEdge: CreateAccountMappingPayload_accountMappingEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      deletedAccountMappingId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_AccountMapping.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      query: queryPlan
    }
  },
  DeleteAccountPayload: {
    assertStep: ObjectStep,
    plans: {
      account: planCreatePayloadResult,
      accountEdge: CreateAccountPayload_accountEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      deletedAccountId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_Account.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      query: queryPlan
    }
  },
  DeleteBookPayload: {
    assertStep: ObjectStep,
    plans: {
      book: planCreatePayloadResult,
      bookEdge: CreateBookPayload_bookEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      deletedBookId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_Book.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      query: queryPlan
    }
  },
  DeleteBudgetPayload: {
    assertStep: ObjectStep,
    plans: {
      budget: planCreatePayloadResult,
      budgetEdge: CreateBudgetPayload_budgetEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      deletedBudgetId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_Budget.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      query: queryPlan
    }
  },
  DeleteCategorizationRulePayload: {
    assertStep: ObjectStep,
    plans: {
      categorizationRule: planCreatePayloadResult,
      categorizationRuleEdge: CreateCategorizationRulePayload_categorizationRuleEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      deletedCategorizationRuleId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_CategorizationRule.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      query: queryPlan
    }
  },
  DeleteConnectedAccountPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      connectedAccount: planCreatePayloadResult,
      connectedAccountEdge: CreateConnectedAccountPayload_connectedAccountEdgePlan,
      deletedConnectedAccountId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_ConnectedAccount.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      query: queryPlan
    }
  },
  DeleteCryptoAssetPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      cryptoAsset: planCreatePayloadResult,
      cryptoAssetEdge: CreateCryptoAssetPayload_cryptoAssetEdgePlan,
      deletedCryptoAssetId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_CryptoAsset.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      query: queryPlan
    }
  },
  DeleteCryptoLotPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      cryptoLot: planCreatePayloadResult,
      cryptoLotEdge: CreateCryptoLotPayload_cryptoLotEdgePlan,
      deletedCryptoLotId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_CryptoLot.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      query: queryPlan
    }
  },
  DeleteDrizzleMigrationPayload: {
    assertStep: ObjectStep,
    plans: {
      _drizzleMigration: planCreatePayloadResult,
      _drizzleMigrationEdge: CreateDrizzleMigrationPayload__drizzleMigrationEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      deletedDrizzleMigrationId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler__DrizzleMigration.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      query: queryPlan
    }
  },
  DeleteFixedAssetPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      deletedFixedAssetId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_FixedAsset.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      fixedAsset: planCreatePayloadResult,
      fixedAssetEdge: CreateFixedAssetPayload_fixedAssetEdgePlan,
      query: queryPlan
    }
  },
  DeleteJournalEntryPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      deletedJournalEntryId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_JournalEntry.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      journalEntry: planCreatePayloadResult,
      journalEntryEdge: CreateJournalEntryPayload_journalEntryEdgePlan,
      query: queryPlan
    }
  },
  DeleteJournalLinePayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      deletedJournalLineId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_JournalLine.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      journalLine: planCreatePayloadResult,
      journalLineEdge: CreateJournalLinePayload_journalLineEdgePlan,
      query: queryPlan
    }
  },
  DeleteNetWorthSnapshotPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      deletedNetWorthSnapshotId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_NetWorthSnapshot.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      netWorthSnapshot: planCreatePayloadResult,
      netWorthSnapshotEdge: CreateNetWorthSnapshotPayload_netWorthSnapshotEdgePlan,
      query: queryPlan
    }
  },
  DeleteReconciliationQueuePayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      deletedReconciliationQueueId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_ReconciliationQueue.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      query: queryPlan,
      reconciliationQueue: planCreatePayloadResult,
      reconciliationQueueEdge: CreateReconciliationQueuePayload_reconciliationQueueEdgePlan
    }
  },
  DeleteRecurringTransactionPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      deletedRecurringTransactionId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_RecurringTransaction.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      query: queryPlan,
      recurringTransaction: planCreatePayloadResult,
      recurringTransactionEdge: CreateRecurringTransactionPayload_recurringTransactionEdgePlan
    }
  },
  DeleteSavingsGoalPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      deletedSavingsGoalId($object) {
        const $record = $object.getStepForKey("result"),
          specifier = nodeIdHandler_SavingsGoal.plan($record);
        return lambda(specifier, base64JSONNodeIdCodec.encode);
      },
      query: queryPlan,
      savingsGoal: planCreatePayloadResult,
      savingsGoalEdge: CreateSavingsGoalPayload_savingsGoalEdgePlan
    }
  },
  FixedAsset: {
    assertStep: assertPgClassSingleStep,
    plans: {
      accumulatedDepreciationAccount($record) {
        return resource_accountPgResource.get({
          id: $record.get("accumulated_depreciation_account_id")
        });
      },
      accumulatedDepreciationAccountId($record) {
        return $record.get("accumulated_depreciation_account_id");
      },
      acquisitionCost($record) {
        return $record.get("acquisition_cost");
      },
      acquisitionDate($record) {
        return $record.get("acquisition_date");
      },
      assetAccount($record) {
        return resource_accountPgResource.get({
          id: $record.get("asset_account_id")
        });
      },
      assetAccountId($record) {
        return $record.get("asset_account_id");
      },
      book: AccountMapping_bookPlan,
      bookId: AccountMapping_bookIdPlan,
      createdAt: _DrizzleMigration_createdAtPlan,
      depreciationExpenseAccount($record) {
        return resource_accountPgResource.get({
          id: $record.get("depreciation_expense_account_id")
        });
      },
      depreciationExpenseAccountId($record) {
        return $record.get("depreciation_expense_account_id");
      },
      depreciationMethod($record) {
        return $record.get("depreciation_method");
      },
      disposalProceeds($record) {
        return $record.get("disposal_proceeds");
      },
      disposedAt: CryptoLot_disposedAtPlan,
      id($parent) {
        const specifier = nodeIdHandler_FixedAsset.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_FixedAsset.codec.name].encode);
      },
      macrsClass($record) {
        return $record.get("macrs_class");
      },
      rowId: _DrizzleMigration_rowIdPlan,
      salvageValue($record) {
        return $record.get("salvage_value");
      },
      usefulLifeMonths($record) {
        return $record.get("useful_life_months");
      }
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of fixed_assetUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_fixed_assetPgResource.get(spec);
    }
  },
  FixedAssetConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  JournalEntry: {
    assertStep: assertPgClassSingleStep,
    plans: {
      book: AccountMapping_bookPlan,
      bookId: AccountMapping_bookIdPlan,
      createdAt: _DrizzleMigration_createdAtPlan,
      id($parent) {
        const specifier = nodeIdHandler_JournalEntry.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_JournalEntry.codec.name].encode);
      },
      isReconciled($record) {
        return $record.get("is_reconciled");
      },
      isReviewed($record) {
        return $record.get("is_reviewed");
      },
      journalLines: {
        plan($record) {
          const $records = resource_journal_linePgResource.find({
            journal_entry_id: $record.get("id")
          });
          return connection($records);
        },
        args: {
          first: applyFirstArg,
          last: applyLastArg,
          offset: applyOffsetArg,
          before: applyBeforeArg,
          after: applyAfterArg,
          condition: applyConditionArgToConnection,
          filter: Query__drizzleMigrationsfilterApplyPlan,
          orderBy: applyOrderByArgToConnection
        }
      },
      rowId: _DrizzleMigration_rowIdPlan,
      sourceReferenceId($record) {
        return $record.get("source_reference_id");
      },
      updatedAt: AccountMapping_updatedAtPlan
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of journal_entryUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_journal_entryPgResource.get(spec);
    }
  },
  JournalEntryConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  JournalLine: {
    assertStep: assertPgClassSingleStep,
    plans: {
      account: Budget_accountPlan,
      accountId: Budget_accountIdPlan,
      id($parent) {
        const specifier = nodeIdHandler_JournalLine.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_JournalLine.codec.name].encode);
      },
      journalEntry: JournalLine_journalEntryPlan,
      journalEntryId: JournalLine_journalEntryIdPlan,
      rowId: _DrizzleMigration_rowIdPlan
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of journal_lineUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_journal_linePgResource.get(spec);
    }
  },
  JournalLineConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  NetWorthSnapshot: {
    assertStep: assertPgClassSingleStep,
    plans: {
      book: AccountMapping_bookPlan,
      bookId: AccountMapping_bookIdPlan,
      createdAt: _DrizzleMigration_createdAtPlan,
      id($parent) {
        const specifier = nodeIdHandler_NetWorthSnapshot.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_NetWorthSnapshot.codec.name].encode);
      },
      netWorth($record) {
        return $record.get("net_worth");
      },
      rowId: _DrizzleMigration_rowIdPlan,
      totalAssets($record) {
        return $record.get("total_assets");
      },
      totalLiabilities($record) {
        return $record.get("total_liabilities");
      }
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of net_worth_snapshotUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_net_worth_snapshotPgResource.get(spec);
    }
  },
  NetWorthSnapshotConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  ReconciliationQueue: {
    assertStep: assertPgClassSingleStep,
    plans: {
      book: AccountMapping_bookPlan,
      bookId: AccountMapping_bookIdPlan,
      categorizationSource($record) {
        return $record.get("categorization_source");
      },
      createdAt: _DrizzleMigration_createdAtPlan,
      id($parent) {
        const specifier = nodeIdHandler_ReconciliationQueue.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_ReconciliationQueue.codec.name].encode);
      },
      journalEntry: JournalLine_journalEntryPlan,
      journalEntryId: JournalLine_journalEntryIdPlan,
      periodMonth($record) {
        return $record.get("period_month");
      },
      periodYear($record) {
        return $record.get("period_year");
      },
      reviewedAt($record) {
        return $record.get("reviewed_at");
      },
      reviewedBy($record) {
        return $record.get("reviewed_by");
      },
      rowId: _DrizzleMigration_rowIdPlan,
      suggestedCreditAccount($record) {
        return resource_accountPgResource.get({
          id: $record.get("suggested_credit_account_id")
        });
      },
      suggestedCreditAccountId($record) {
        return $record.get("suggested_credit_account_id");
      },
      suggestedDebitAccount($record) {
        return resource_accountPgResource.get({
          id: $record.get("suggested_debit_account_id")
        });
      },
      suggestedDebitAccountId($record) {
        return $record.get("suggested_debit_account_id");
      }
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of reconciliation_queueUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_reconciliation_queuePgResource.get(spec);
    }
  },
  ReconciliationQueueConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  RecurringTransaction: {
    assertStep: assertPgClassSingleStep,
    plans: {
      account: Budget_accountPlan,
      accountId: Budget_accountIdPlan,
      book: AccountMapping_bookPlan,
      bookId: AccountMapping_bookIdPlan,
      counterAccount($record) {
        return resource_accountPgResource.get({
          id: $record.get("counter_account_id")
        });
      },
      counterAccountId($record) {
        return $record.get("counter_account_id");
      },
      createdAt: _DrizzleMigration_createdAtPlan,
      id($parent) {
        const specifier = nodeIdHandler_RecurringTransaction.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_RecurringTransaction.codec.name].encode);
      },
      isActive: Account_isActivePlan,
      isAutoDetected($record) {
        return $record.get("is_auto_detected");
      },
      nextExpectedDate($record) {
        return $record.get("next_expected_date");
      },
      rowId: _DrizzleMigration_rowIdPlan,
      updatedAt: AccountMapping_updatedAtPlan
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of recurring_transactionUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_recurring_transactionPgResource.get(spec);
    }
  },
  RecurringTransactionConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  SavingsGoal: {
    assertStep: assertPgClassSingleStep,
    plans: {
      account: Budget_accountPlan,
      accountId: Budget_accountIdPlan,
      book: AccountMapping_bookPlan,
      bookId: AccountMapping_bookIdPlan,
      createdAt: _DrizzleMigration_createdAtPlan,
      id($parent) {
        const specifier = nodeIdHandler_SavingsGoal.plan($parent);
        return lambda(specifier, nodeIdCodecs[nodeIdHandler_SavingsGoal.codec.name].encode);
      },
      rowId: _DrizzleMigration_rowIdPlan,
      targetAmount($record) {
        return $record.get("target_amount");
      },
      targetDate($record) {
        return $record.get("target_date");
      },
      updatedAt: AccountMapping_updatedAtPlan
    },
    planType($specifier) {
      const spec = Object.create(null);
      for (const pkCol of savings_goalUniques[0].attributes) spec[pkCol] = get2($specifier, pkCol);
      return resource_savings_goalPgResource.get(spec);
    }
  },
  SavingsGoalConnection: {
    assertStep: ConnectionStep,
    plans: {
      totalCount: totalCountConnectionPlan
    }
  },
  UpdateAccountingPeriodPayload: {
    assertStep: ObjectStep,
    plans: {
      accountingPeriod: planCreatePayloadResult,
      accountingPeriodEdge: CreateAccountingPeriodPayload_accountingPeriodEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan
    }
  },
  UpdateAccountMappingPayload: {
    assertStep: ObjectStep,
    plans: {
      accountMapping: planCreatePayloadResult,
      accountMappingEdge: CreateAccountMappingPayload_accountMappingEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan
    }
  },
  UpdateAccountPayload: {
    assertStep: ObjectStep,
    plans: {
      account: planCreatePayloadResult,
      accountEdge: CreateAccountPayload_accountEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan
    }
  },
  UpdateBookPayload: {
    assertStep: ObjectStep,
    plans: {
      book: planCreatePayloadResult,
      bookEdge: CreateBookPayload_bookEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan
    }
  },
  UpdateBudgetPayload: {
    assertStep: ObjectStep,
    plans: {
      budget: planCreatePayloadResult,
      budgetEdge: CreateBudgetPayload_budgetEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan
    }
  },
  UpdateCategorizationRulePayload: {
    assertStep: ObjectStep,
    plans: {
      categorizationRule: planCreatePayloadResult,
      categorizationRuleEdge: CreateCategorizationRulePayload_categorizationRuleEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan
    }
  },
  UpdateConnectedAccountPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      connectedAccount: planCreatePayloadResult,
      connectedAccountEdge: CreateConnectedAccountPayload_connectedAccountEdgePlan,
      query: queryPlan
    }
  },
  UpdateCryptoAssetPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      cryptoAsset: planCreatePayloadResult,
      cryptoAssetEdge: CreateCryptoAssetPayload_cryptoAssetEdgePlan,
      query: queryPlan
    }
  },
  UpdateCryptoLotPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      cryptoLot: planCreatePayloadResult,
      cryptoLotEdge: CreateCryptoLotPayload_cryptoLotEdgePlan,
      query: queryPlan
    }
  },
  UpdateDrizzleMigrationPayload: {
    assertStep: ObjectStep,
    plans: {
      _drizzleMigration: planCreatePayloadResult,
      _drizzleMigrationEdge: CreateDrizzleMigrationPayload__drizzleMigrationEdgePlan,
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan
    }
  },
  UpdateFixedAssetPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      fixedAsset: planCreatePayloadResult,
      fixedAssetEdge: CreateFixedAssetPayload_fixedAssetEdgePlan,
      query: queryPlan
    }
  },
  UpdateJournalEntryPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      journalEntry: planCreatePayloadResult,
      journalEntryEdge: CreateJournalEntryPayload_journalEntryEdgePlan,
      query: queryPlan
    }
  },
  UpdateJournalLinePayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      journalLine: planCreatePayloadResult,
      journalLineEdge: CreateJournalLinePayload_journalLineEdgePlan,
      query: queryPlan
    }
  },
  UpdateNetWorthSnapshotPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      netWorthSnapshot: planCreatePayloadResult,
      netWorthSnapshotEdge: CreateNetWorthSnapshotPayload_netWorthSnapshotEdgePlan,
      query: queryPlan
    }
  },
  UpdateReconciliationQueuePayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan,
      reconciliationQueue: planCreatePayloadResult,
      reconciliationQueueEdge: CreateReconciliationQueuePayload_reconciliationQueueEdgePlan
    }
  },
  UpdateRecurringTransactionPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan,
      recurringTransaction: planCreatePayloadResult,
      recurringTransactionEdge: CreateRecurringTransactionPayload_recurringTransactionEdgePlan
    }
  },
  UpdateSavingsGoalPayload: {
    assertStep: ObjectStep,
    plans: {
      clientMutationId: getClientMutationIdForCreatePlan,
      query: queryPlan,
      savingsGoal: planCreatePayloadResult,
      savingsGoalEdge: CreateSavingsGoalPayload_savingsGoalEdgePlan
    }
  }
};
export const interfaces = {
  Node: {
    planType($nodeId) {
      const $specifier = decodeNodeId($nodeId);
      return {
        $__typename: lambda($specifier, findTypeNameMatch, !0),
        planForType(type) {
          const spec = nodeIdHandlerByTypeName[type.name];
          if (spec) return spec.get(spec.getSpec(access($specifier, [spec.codec.name])));else throw Error(`Failed to find handler for ${type.name}`);
        }
      };
    }
  }
};
export const inputObjects = {
  _DrizzleMigrationCondition: {
    plans: {
      rowId($condition, val) {
        return applyAttributeCondition("id", TYPES.int, $condition, val);
      }
    }
  },
  _DrizzleMigrationFilter: {
    plans: {
      and: AccountFilter_andApply,
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec___drizzleMigrations.attributes.id, queryBuilder, value);
      }
    }
  },
  _DrizzleMigrationInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      createdAt: _DrizzleMigrationInput_createdAtApply,
      hash: _DrizzleMigrationInput_hashApply,
      rowId: _DrizzleMigrationInput_rowIdApply
    }
  },
  _DrizzleMigrationPatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      createdAt: _DrizzleMigrationInput_createdAtApply,
      hash: _DrizzleMigrationInput_hashApply,
      rowId: _DrizzleMigrationInput_rowIdApply
    }
  },
  AccountCondition: {
    plans: {
      bookId: AccountCondition_bookIdApply,
      parentId($condition, val) {
        return applyAttributeCondition("parent_id", TYPES.uuid, $condition, val);
      },
      rowId: AccountCondition_rowIdApply,
      type($condition, val) {
        return applyAttributeCondition("type", accountTypeCodec, $condition, val);
      }
    }
  },
  AccountFilter: {
    plans: {
      and: AccountFilter_andApply,
      book($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_bookPgResource, bookIdentifier, registryConfig.pgRelations.account.bookByMyBookId.localAttributes, registryConfig.pgRelations.account.bookByMyBookId.remoteAttributes, $where, value);
      },
      bookId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("bookId", "book_id", spec_account.attributes.book_id, queryBuilder, value);
      },
      budgets($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: budgetIdentifier,
          alias: resource_budgetPgResource.name,
          localAttributes: registryConfig.pgRelations.account.budgetsByTheirAccountId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.account.budgetsByTheirAccountId.remoteAttributes
        };
        return $rel;
      },
      budgetsExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: budgetIdentifier,
          alias: resource_budgetPgResource.name,
          equals: value
        });
        registryConfig.pgRelations.account.budgetsByTheirAccountId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.account.budgetsByTheirAccountId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      childAccounts($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: accountIdentifier,
          alias: resource_accountPgResource.name,
          localAttributes: registryConfig.pgRelations.account.accountsByTheirParentId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.account.accountsByTheirParentId.remoteAttributes
        };
        return $rel;
      },
      childAccountsExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: accountIdentifier,
          alias: resource_accountPgResource.name,
          equals: value
        });
        registryConfig.pgRelations.account.accountsByTheirParentId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.account.accountsByTheirParentId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      journalLines($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: journalLineIdentifier,
          alias: resource_journal_linePgResource.name,
          localAttributes: registryConfig.pgRelations.account.journalLinesByTheirAccountId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.account.journalLinesByTheirAccountId.remoteAttributes
        };
        return $rel;
      },
      journalLinesExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: journalLineIdentifier,
          alias: resource_journal_linePgResource.name,
          equals: value
        });
        registryConfig.pgRelations.account.journalLinesByTheirAccountId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.account.journalLinesByTheirAccountId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      parent($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.account.accountByMyParentId.localAttributes, registryConfig.pgRelations.account.accountByMyParentId.remoteAttributes, $where, value);
      },
      parentExists($where, value) {
        return pgConnectionFilterApplyForwardRelationExists(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.account.accountByMyParentId.localAttributes, registryConfig.pgRelations.account.accountByMyParentId.remoteAttributes, $where, value);
      },
      parentId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("parentId", "parent_id", spec_account.attributes.parent_id, queryBuilder, value);
      },
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_account.attributes.id, queryBuilder, value);
      },
      type(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("type", "type", spec_account.attributes.type, queryBuilder, value);
      }
    }
  },
  AccountingPeriodCondition: {
    plans: {
      bookId: AccountCondition_bookIdApply,
      month($condition, val) {
        return applyAttributeCondition("month", TYPES.int, $condition, val);
      },
      rowId: AccountCondition_rowIdApply,
      status($condition, val) {
        return applyAttributeCondition("status", TYPES.text, $condition, val);
      },
      year($condition, val) {
        return applyAttributeCondition("year", TYPES.int, $condition, val);
      }
    }
  },
  AccountingPeriodFilter: {
    plans: {
      and: AccountFilter_andApply,
      book($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_bookPgResource, bookIdentifier, registryConfig.pgRelations.accountingPeriod.bookByMyBookId.localAttributes, registryConfig.pgRelations.accountingPeriod.bookByMyBookId.remoteAttributes, $where, value);
      },
      bookId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("bookId", "book_id", spec_accountingPeriod.attributes.book_id, queryBuilder, value);
      },
      month(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("month", "month", spec_accountingPeriod.attributes.month, queryBuilder, value);
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_accountingPeriod.attributes.id, queryBuilder, value);
      },
      status(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("status", "status", spec_accountingPeriod.attributes.status, queryBuilder, value);
      },
      year(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("year", "year", spec_accountingPeriod.attributes.year, queryBuilder, value);
      }
    }
  },
  AccountingPeriodInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      blockers: AccountingPeriodInput_blockersApply,
      bookId: AccountMappingInput_bookIdApply,
      closedAt: AccountingPeriodInput_closedAtApply,
      closedBy: AccountingPeriodInput_closedByApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      month: AccountingPeriodInput_monthApply,
      reopenedAt: AccountingPeriodInput_reopenedAtApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      status: AccountingPeriodInput_statusApply,
      year: AccountingPeriodInput_yearApply
    }
  },
  AccountingPeriodPatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      blockers: AccountingPeriodInput_blockersApply,
      bookId: AccountMappingInput_bookIdApply,
      closedAt: AccountingPeriodInput_closedAtApply,
      closedBy: AccountingPeriodInput_closedByApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      month: AccountingPeriodInput_monthApply,
      reopenedAt: AccountingPeriodInput_reopenedAtApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      status: AccountingPeriodInput_statusApply,
      year: AccountingPeriodInput_yearApply
    }
  },
  AccountInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      bookId: AccountMappingInput_bookIdApply,
      code: AccountInput_codeApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      isActive: RecurringTransactionInput_isActiveApply,
      isPlaceholder: AccountInput_isPlaceholderApply,
      name: SavingsGoalInput_nameApply,
      parentId: AccountInput_parentIdApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      subType: AccountInput_subTypeApply,
      type: BookInput_typeApply,
      updatedAt: AccountMappingInput_updatedAtApply
    }
  },
  AccountMappingCondition: {
    plans: {
      bookId: AccountCondition_bookIdApply,
      eventType($condition, val) {
        return applyAttributeCondition("event_type", TYPES.text, $condition, val);
      },
      rowId: AccountCondition_rowIdApply
    }
  },
  AccountMappingFilter: {
    plans: {
      and: AccountFilter_andApply,
      book($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_bookPgResource, bookIdentifier, registryConfig.pgRelations.accountMapping.bookByMyBookId.localAttributes, registryConfig.pgRelations.accountMapping.bookByMyBookId.remoteAttributes, $where, value);
      },
      bookId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("bookId", "book_id", spec_accountMapping.attributes.book_id, queryBuilder, value);
      },
      creditAccount($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.accountMapping.accountByMyCreditAccountId.localAttributes, registryConfig.pgRelations.accountMapping.accountByMyCreditAccountId.remoteAttributes, $where, value);
      },
      debitAccount($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.accountMapping.accountByMyDebitAccountId.localAttributes, registryConfig.pgRelations.accountMapping.accountByMyDebitAccountId.remoteAttributes, $where, value);
      },
      eventType(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("eventType", "event_type", spec_accountMapping.attributes.event_type, queryBuilder, value);
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_accountMapping.attributes.id, queryBuilder, value);
      }
    }
  },
  AccountMappingInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      bookId: AccountMappingInput_bookIdApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      creditAccountId: AccountMappingInput_creditAccountIdApply,
      debitAccountId: AccountMappingInput_debitAccountIdApply,
      eventType: AccountMappingInput_eventTypeApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      updatedAt: AccountMappingInput_updatedAtApply
    }
  },
  AccountMappingPatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      bookId: AccountMappingInput_bookIdApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      creditAccountId: AccountMappingInput_creditAccountIdApply,
      debitAccountId: AccountMappingInput_debitAccountIdApply,
      eventType: AccountMappingInput_eventTypeApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      updatedAt: AccountMappingInput_updatedAtApply
    }
  },
  AccountPatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      bookId: AccountMappingInput_bookIdApply,
      code: AccountInput_codeApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      isActive: RecurringTransactionInput_isActiveApply,
      isPlaceholder: AccountInput_isPlaceholderApply,
      name: SavingsGoalInput_nameApply,
      parentId: AccountInput_parentIdApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      subType: AccountInput_subTypeApply,
      type: BookInput_typeApply,
      updatedAt: AccountMappingInput_updatedAtApply
    }
  },
  AccountToManyAccountFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  AccountToManyBudgetFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  AccountToManyJournalLineFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  AccountTypeFilter: {
    plans: {
      distinctFrom: pgAggregatesApply_distinctFrom,
      equalTo: pgAggregatesApply_equalTo,
      greaterThan: pgAggregatesApply_greaterThan,
      greaterThanOrEqualTo: pgAggregatesApply_greaterThanOrEqualTo,
      in: pgAggregatesApply_in,
      isNull: pgAggregatesApply_isNull,
      lessThan: pgAggregatesApply_lessThan,
      lessThanOrEqualTo: pgAggregatesApply_lessThanOrEqualTo,
      notDistinctFrom: pgAggregatesApply_notDistinctFrom,
      notEqualTo: pgAggregatesApply_notEqualTo,
      notIn: pgAggregatesApply_notIn
    }
  },
  BookCondition: {
    plans: {
      organizationId($condition, val) {
        return applyAttributeCondition("organization_id", TYPES.text, $condition, val);
      },
      rowId: AccountCondition_rowIdApply
    }
  },
  BookFilter: {
    plans: {
      accountingPeriods($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: accountingPeriodIdentifier,
          alias: resource_accounting_periodPgResource.name,
          localAttributes: registryConfig.pgRelations.book.accountingPeriodsByTheirBookId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.book.accountingPeriodsByTheirBookId.remoteAttributes
        };
        return $rel;
      },
      accountingPeriodsExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: accountingPeriodIdentifier,
          alias: resource_accounting_periodPgResource.name,
          equals: value
        });
        registryConfig.pgRelations.book.accountingPeriodsByTheirBookId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.book.accountingPeriodsByTheirBookId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      accountMappings($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: accountMappingIdentifier,
          alias: resource_account_mappingPgResource.name,
          localAttributes: registryConfig.pgRelations.book.accountMappingsByTheirBookId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.book.accountMappingsByTheirBookId.remoteAttributes
        };
        return $rel;
      },
      accountMappingsExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: accountMappingIdentifier,
          alias: resource_account_mappingPgResource.name,
          equals: value
        });
        registryConfig.pgRelations.book.accountMappingsByTheirBookId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.book.accountMappingsByTheirBookId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      accounts($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: accountIdentifier,
          alias: resource_accountPgResource.name,
          localAttributes: registryConfig.pgRelations.book.accountsByTheirBookId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.book.accountsByTheirBookId.remoteAttributes
        };
        return $rel;
      },
      accountsExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: accountIdentifier,
          alias: resource_accountPgResource.name,
          equals: value
        });
        registryConfig.pgRelations.book.accountsByTheirBookId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.book.accountsByTheirBookId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      and: AccountFilter_andApply,
      budgets($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: budgetIdentifier,
          alias: resource_budgetPgResource.name,
          localAttributes: registryConfig.pgRelations.book.budgetsByTheirBookId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.book.budgetsByTheirBookId.remoteAttributes
        };
        return $rel;
      },
      budgetsExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: budgetIdentifier,
          alias: resource_budgetPgResource.name,
          equals: value
        });
        registryConfig.pgRelations.book.budgetsByTheirBookId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.book.budgetsByTheirBookId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      categorizationRules($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: categorizationRuleIdentifier,
          alias: resource_categorization_rulePgResource.name,
          localAttributes: registryConfig.pgRelations.book.categorizationRulesByTheirBookId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.book.categorizationRulesByTheirBookId.remoteAttributes
        };
        return $rel;
      },
      categorizationRulesExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: categorizationRuleIdentifier,
          alias: resource_categorization_rulePgResource.name,
          equals: value
        });
        registryConfig.pgRelations.book.categorizationRulesByTheirBookId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.book.categorizationRulesByTheirBookId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      connectedAccounts($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: connectedAccountIdentifier,
          alias: resource_connected_accountPgResource.name,
          localAttributes: registryConfig.pgRelations.book.connectedAccountsByTheirBookId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.book.connectedAccountsByTheirBookId.remoteAttributes
        };
        return $rel;
      },
      connectedAccountsExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: connectedAccountIdentifier,
          alias: resource_connected_accountPgResource.name,
          equals: value
        });
        registryConfig.pgRelations.book.connectedAccountsByTheirBookId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.book.connectedAccountsByTheirBookId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      cryptoAssets($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: cryptoAssetIdentifier,
          alias: resource_crypto_assetPgResource.name,
          localAttributes: registryConfig.pgRelations.book.cryptoAssetsByTheirBookId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.book.cryptoAssetsByTheirBookId.remoteAttributes
        };
        return $rel;
      },
      cryptoAssetsExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: cryptoAssetIdentifier,
          alias: resource_crypto_assetPgResource.name,
          equals: value
        });
        registryConfig.pgRelations.book.cryptoAssetsByTheirBookId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.book.cryptoAssetsByTheirBookId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      fixedAssets($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: fixedAssetIdentifier,
          alias: resource_fixed_assetPgResource.name,
          localAttributes: registryConfig.pgRelations.book.fixedAssetsByTheirBookId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.book.fixedAssetsByTheirBookId.remoteAttributes
        };
        return $rel;
      },
      fixedAssetsExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: fixedAssetIdentifier,
          alias: resource_fixed_assetPgResource.name,
          equals: value
        });
        registryConfig.pgRelations.book.fixedAssetsByTheirBookId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.book.fixedAssetsByTheirBookId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      journalEntries($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: journalEntryIdentifier,
          alias: resource_journal_entryPgResource.name,
          localAttributes: registryConfig.pgRelations.book.journalEntriesByTheirBookId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.book.journalEntriesByTheirBookId.remoteAttributes
        };
        return $rel;
      },
      journalEntriesExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: journalEntryIdentifier,
          alias: resource_journal_entryPgResource.name,
          equals: value
        });
        registryConfig.pgRelations.book.journalEntriesByTheirBookId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.book.journalEntriesByTheirBookId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      netWorthSnapshots($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: netWorthSnapshotIdentifier,
          alias: resource_net_worth_snapshotPgResource.name,
          localAttributes: registryConfig.pgRelations.book.netWorthSnapshotsByTheirBookId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.book.netWorthSnapshotsByTheirBookId.remoteAttributes
        };
        return $rel;
      },
      netWorthSnapshotsExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: netWorthSnapshotIdentifier,
          alias: resource_net_worth_snapshotPgResource.name,
          equals: value
        });
        registryConfig.pgRelations.book.netWorthSnapshotsByTheirBookId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.book.netWorthSnapshotsByTheirBookId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      organizationId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("organizationId", "organization_id", spec_book.attributes.organization_id, queryBuilder, value);
      },
      reconciliationQueues($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: reconciliationQueueIdentifier,
          alias: resource_reconciliation_queuePgResource.name,
          localAttributes: registryConfig.pgRelations.book.reconciliationQueuesByTheirBookId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.book.reconciliationQueuesByTheirBookId.remoteAttributes
        };
        return $rel;
      },
      reconciliationQueuesExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: reconciliationQueueIdentifier,
          alias: resource_reconciliation_queuePgResource.name,
          equals: value
        });
        registryConfig.pgRelations.book.reconciliationQueuesByTheirBookId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.book.reconciliationQueuesByTheirBookId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      recurringTransactions($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: recurringTransactionIdentifier,
          alias: resource_recurring_transactionPgResource.name,
          localAttributes: registryConfig.pgRelations.book.recurringTransactionsByTheirBookId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.book.recurringTransactionsByTheirBookId.remoteAttributes
        };
        return $rel;
      },
      recurringTransactionsExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: recurringTransactionIdentifier,
          alias: resource_recurring_transactionPgResource.name,
          equals: value
        });
        registryConfig.pgRelations.book.recurringTransactionsByTheirBookId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.book.recurringTransactionsByTheirBookId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_book.attributes.id, queryBuilder, value);
      },
      savingsGoals($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: savingsGoalIdentifier,
          alias: resource_savings_goalPgResource.name,
          localAttributes: registryConfig.pgRelations.book.savingsGoalsByTheirBookId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.book.savingsGoalsByTheirBookId.remoteAttributes
        };
        return $rel;
      },
      savingsGoalsExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: savingsGoalIdentifier,
          alias: resource_savings_goalPgResource.name,
          equals: value
        });
        registryConfig.pgRelations.book.savingsGoalsByTheirBookId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.book.savingsGoalsByTheirBookId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      }
    }
  },
  BookInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      createdAt: _DrizzleMigrationInput_createdAtApply,
      currency: BookInput_currencyApply,
      fiscalYearStartMonth: BookInput_fiscalYearStartMonthApply,
      name: SavingsGoalInput_nameApply,
      organizationId: BookInput_organizationIdApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      type: BookInput_typeApply,
      updatedAt: AccountMappingInput_updatedAtApply
    }
  },
  BookPatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      createdAt: _DrizzleMigrationInput_createdAtApply,
      currency: BookInput_currencyApply,
      fiscalYearStartMonth: BookInput_fiscalYearStartMonthApply,
      name: SavingsGoalInput_nameApply,
      organizationId: BookInput_organizationIdApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      type: BookInput_typeApply,
      updatedAt: AccountMappingInput_updatedAtApply
    }
  },
  BookToManyAccountFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  BookToManyAccountingPeriodFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  BookToManyAccountMappingFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  BookToManyBudgetFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  BookToManyCategorizationRuleFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  BookToManyConnectedAccountFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  BookToManyCryptoAssetFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  BookToManyFixedAssetFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  BookToManyJournalEntryFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  BookToManyNetWorthSnapshotFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  BookToManyReconciliationQueueFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  BookToManyRecurringTransactionFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  BookToManySavingsGoalFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  BudgetCondition: {
    plans: {
      accountId: BudgetCondition_accountIdApply,
      bookId: AccountCondition_bookIdApply,
      rowId: AccountCondition_rowIdApply
    }
  },
  BudgetFilter: {
    plans: {
      account($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.budget.accountByMyAccountId.localAttributes, registryConfig.pgRelations.budget.accountByMyAccountId.remoteAttributes, $where, value);
      },
      accountId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("accountId", "account_id", spec_budget.attributes.account_id, queryBuilder, value);
      },
      and: AccountFilter_andApply,
      book($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_bookPgResource, bookIdentifier, registryConfig.pgRelations.budget.bookByMyBookId.localAttributes, registryConfig.pgRelations.budget.bookByMyBookId.remoteAttributes, $where, value);
      },
      bookId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("bookId", "book_id", spec_budget.attributes.book_id, queryBuilder, value);
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_budget.attributes.id, queryBuilder, value);
      }
    }
  },
  BudgetInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      accountId: JournalLineInput_accountIdApply,
      amount: BudgetInput_amountApply,
      bookId: AccountMappingInput_bookIdApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      period: BudgetInput_periodApply,
      rollover: BudgetInput_rolloverApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      updatedAt: AccountMappingInput_updatedAtApply
    }
  },
  BudgetPatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      accountId: JournalLineInput_accountIdApply,
      amount: BudgetInput_amountApply,
      bookId: AccountMappingInput_bookIdApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      period: BudgetInput_periodApply,
      rollover: BudgetInput_rolloverApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      updatedAt: AccountMappingInput_updatedAtApply
    }
  },
  CategorizationRuleCondition: {
    plans: {
      bookId: AccountCondition_bookIdApply,
      matchField($condition, val) {
        return applyAttributeCondition("match_field", TYPES.text, $condition, val);
      },
      rowId: AccountCondition_rowIdApply
    }
  },
  CategorizationRuleFilter: {
    plans: {
      and: AccountFilter_andApply,
      book($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_bookPgResource, bookIdentifier, registryConfig.pgRelations.categorizationRule.bookByMyBookId.localAttributes, registryConfig.pgRelations.categorizationRule.bookByMyBookId.remoteAttributes, $where, value);
      },
      bookId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("bookId", "book_id", spec_categorizationRule.attributes.book_id, queryBuilder, value);
      },
      creditAccount($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.categorizationRule.accountByMyCreditAccountId.localAttributes, registryConfig.pgRelations.categorizationRule.accountByMyCreditAccountId.remoteAttributes, $where, value);
      },
      debitAccount($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.categorizationRule.accountByMyDebitAccountId.localAttributes, registryConfig.pgRelations.categorizationRule.accountByMyDebitAccountId.remoteAttributes, $where, value);
      },
      matchField(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("matchField", "match_field", spec_categorizationRule.attributes.match_field, queryBuilder, value);
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_categorizationRule.attributes.id, queryBuilder, value);
      }
    }
  },
  CategorizationRuleInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      amountMax: CategorizationRuleInput_amountMaxApply,
      amountMin: CategorizationRuleInput_amountMinApply,
      bookId: AccountMappingInput_bookIdApply,
      confidence: CategorizationRuleInput_confidenceApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      creditAccountId: AccountMappingInput_creditAccountIdApply,
      debitAccountId: AccountMappingInput_debitAccountIdApply,
      hitCount: CategorizationRuleInput_hitCountApply,
      lastHitAt: CategorizationRuleInput_lastHitAtApply,
      matchField: CategorizationRuleInput_matchFieldApply,
      matchType: CategorizationRuleInput_matchTypeApply,
      matchValue: CategorizationRuleInput_matchValueApply,
      name: SavingsGoalInput_nameApply,
      priority: CategorizationRuleInput_priorityApply,
      rowId: _DrizzleMigrationInput_rowIdApply
    }
  },
  CategorizationRulePatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      amountMax: CategorizationRuleInput_amountMaxApply,
      amountMin: CategorizationRuleInput_amountMinApply,
      bookId: AccountMappingInput_bookIdApply,
      confidence: CategorizationRuleInput_confidenceApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      creditAccountId: AccountMappingInput_creditAccountIdApply,
      debitAccountId: AccountMappingInput_debitAccountIdApply,
      hitCount: CategorizationRuleInput_hitCountApply,
      lastHitAt: CategorizationRuleInput_lastHitAtApply,
      matchField: CategorizationRuleInput_matchFieldApply,
      matchType: CategorizationRuleInput_matchTypeApply,
      matchValue: CategorizationRuleInput_matchValueApply,
      name: SavingsGoalInput_nameApply,
      priority: CategorizationRuleInput_priorityApply,
      rowId: _DrizzleMigrationInput_rowIdApply
    }
  },
  ConnectedAccountCondition: {
    plans: {
      bookId: AccountCondition_bookIdApply,
      provider($condition, val) {
        return applyAttributeCondition("provider", connectedAccountProviderCodec, $condition, val);
      },
      rowId: AccountCondition_rowIdApply
    }
  },
  ConnectedAccountFilter: {
    plans: {
      account($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.connectedAccount.accountByMyAccountId.localAttributes, registryConfig.pgRelations.connectedAccount.accountByMyAccountId.remoteAttributes, $where, value);
      },
      accountExists($where, value) {
        return pgConnectionFilterApplyForwardRelationExists(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.connectedAccount.accountByMyAccountId.localAttributes, registryConfig.pgRelations.connectedAccount.accountByMyAccountId.remoteAttributes, $where, value);
      },
      and: AccountFilter_andApply,
      book($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_bookPgResource, bookIdentifier, registryConfig.pgRelations.connectedAccount.bookByMyBookId.localAttributes, registryConfig.pgRelations.connectedAccount.bookByMyBookId.remoteAttributes, $where, value);
      },
      bookId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("bookId", "book_id", spec_connectedAccount.attributes.book_id, queryBuilder, value);
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      provider(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("provider", "provider", spec_connectedAccount.attributes.provider, queryBuilder, value);
      },
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_connectedAccount.attributes.id, queryBuilder, value);
      }
    }
  },
  ConnectedAccountInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      accessToken: ConnectedAccountInput_accessTokenApply,
      accountId: JournalLineInput_accountIdApply,
      bookId: AccountMappingInput_bookIdApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      institutionName: ConnectedAccountInput_institutionNameApply,
      lastSyncedAt: CryptoAssetInput_lastSyncedAtApply,
      mask: ConnectedAccountInput_maskApply,
      provider: ConnectedAccountInput_providerApply,
      providerAccountId: ConnectedAccountInput_providerAccountIdApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      status: AccountingPeriodInput_statusApply,
      syncCursor: ConnectedAccountInput_syncCursorApply
    }
  },
  ConnectedAccountPatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      accessToken: ConnectedAccountInput_accessTokenApply,
      accountId: JournalLineInput_accountIdApply,
      bookId: AccountMappingInput_bookIdApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      institutionName: ConnectedAccountInput_institutionNameApply,
      lastSyncedAt: CryptoAssetInput_lastSyncedAtApply,
      mask: ConnectedAccountInput_maskApply,
      provider: ConnectedAccountInput_providerApply,
      providerAccountId: ConnectedAccountInput_providerAccountIdApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      status: AccountingPeriodInput_statusApply,
      syncCursor: ConnectedAccountInput_syncCursorApply
    }
  },
  ConnectedAccountProviderFilter: {
    plans: {
      distinctFrom: pgAggregatesApply_distinctFrom,
      equalTo: pgAggregatesApply_equalTo,
      greaterThan: pgAggregatesApply_greaterThan,
      greaterThanOrEqualTo: pgAggregatesApply_greaterThanOrEqualTo,
      in: pgAggregatesApply_in,
      isNull: pgAggregatesApply_isNull,
      lessThan: pgAggregatesApply_lessThan,
      lessThanOrEqualTo: pgAggregatesApply_lessThanOrEqualTo,
      notDistinctFrom: pgAggregatesApply_notDistinctFrom,
      notEqualTo: pgAggregatesApply_notEqualTo,
      notIn: pgAggregatesApply_notIn
    }
  },
  CreateAccountingPeriodInput: {
    plans: {
      accountingPeriod: applyCreateFields,
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  CreateAccountInput: {
    plans: {
      account: applyCreateFields,
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  CreateAccountMappingInput: {
    plans: {
      accountMapping: applyCreateFields,
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  CreateBookInput: {
    plans: {
      book: applyCreateFields,
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  CreateBudgetInput: {
    plans: {
      budget: applyCreateFields,
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  CreateCategorizationRuleInput: {
    plans: {
      categorizationRule: applyCreateFields,
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  CreateConnectedAccountInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      connectedAccount: applyCreateFields
    }
  },
  CreateCryptoAssetInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      cryptoAsset: applyCreateFields
    }
  },
  CreateCryptoLotInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      cryptoLot: applyCreateFields
    }
  },
  CreateDrizzleMigrationInput: {
    plans: {
      _drizzleMigration: applyCreateFields,
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  CreateFixedAssetInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      fixedAsset: applyCreateFields
    }
  },
  CreateJournalEntryInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      journalEntry: applyCreateFields
    }
  },
  CreateJournalLineInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      journalLine: applyCreateFields
    }
  },
  CreateNetWorthSnapshotInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      netWorthSnapshot: applyCreateFields
    }
  },
  CreateReconciliationQueueInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      reconciliationQueue: applyCreateFields
    }
  },
  CreateRecurringTransactionInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      recurringTransaction: applyCreateFields
    }
  },
  CreateSavingsGoalInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      savingsGoal: applyCreateFields
    }
  },
  CryptoAssetCondition: {
    plans: {
      bookId: AccountCondition_bookIdApply,
      rowId: AccountCondition_rowIdApply,
      symbol($condition, val) {
        return applyAttributeCondition("symbol", TYPES.text, $condition, val);
      }
    }
  },
  CryptoAssetFilter: {
    plans: {
      and: AccountFilter_andApply,
      book($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_bookPgResource, bookIdentifier, registryConfig.pgRelations.cryptoAsset.bookByMyBookId.localAttributes, registryConfig.pgRelations.cryptoAsset.bookByMyBookId.remoteAttributes, $where, value);
      },
      bookId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("bookId", "book_id", spec_cryptoAsset.attributes.book_id, queryBuilder, value);
      },
      cryptoLots($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: cryptoLotIdentifier,
          alias: resource_crypto_lotPgResource.name,
          localAttributes: registryConfig.pgRelations.cryptoAsset.cryptoLotsByTheirCryptoAssetId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.cryptoAsset.cryptoLotsByTheirCryptoAssetId.remoteAttributes
        };
        return $rel;
      },
      cryptoLotsExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: cryptoLotIdentifier,
          alias: resource_crypto_lotPgResource.name,
          equals: value
        });
        registryConfig.pgRelations.cryptoAsset.cryptoLotsByTheirCryptoAssetId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.cryptoAsset.cryptoLotsByTheirCryptoAssetId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_cryptoAsset.attributes.id, queryBuilder, value);
      },
      symbol(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("symbol", "symbol", spec_cryptoAsset.attributes.symbol, queryBuilder, value);
      }
    }
  },
  CryptoAssetInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      balance: CryptoAssetInput_balanceApply,
      bookId: AccountMappingInput_bookIdApply,
      costBasisMethod: CryptoAssetInput_costBasisMethodApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      lastSyncedAt: CryptoAssetInput_lastSyncedAtApply,
      name: SavingsGoalInput_nameApply,
      network: CryptoAssetInput_networkApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      symbol: CryptoAssetInput_symbolApply,
      updatedAt: AccountMappingInput_updatedAtApply,
      walletAddress: CryptoAssetInput_walletAddressApply
    }
  },
  CryptoAssetPatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      balance: CryptoAssetInput_balanceApply,
      bookId: AccountMappingInput_bookIdApply,
      costBasisMethod: CryptoAssetInput_costBasisMethodApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      lastSyncedAt: CryptoAssetInput_lastSyncedAtApply,
      name: SavingsGoalInput_nameApply,
      network: CryptoAssetInput_networkApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      symbol: CryptoAssetInput_symbolApply,
      updatedAt: AccountMappingInput_updatedAtApply,
      walletAddress: CryptoAssetInput_walletAddressApply
    }
  },
  CryptoAssetToManyCryptoLotFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  CryptoLotCondition: {
    plans: {
      cryptoAssetId($condition, val) {
        return applyAttributeCondition("crypto_asset_id", TYPES.uuid, $condition, val);
      },
      rowId: AccountCondition_rowIdApply
    }
  },
  CryptoLotFilter: {
    plans: {
      and: AccountFilter_andApply,
      cryptoAsset($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_crypto_assetPgResource, cryptoAssetIdentifier, registryConfig.pgRelations.cryptoLot.cryptoAssetByMyCryptoAssetId.localAttributes, registryConfig.pgRelations.cryptoLot.cryptoAssetByMyCryptoAssetId.remoteAttributes, $where, value);
      },
      cryptoAssetId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("cryptoAssetId", "crypto_asset_id", spec_cryptoLot.attributes.crypto_asset_id, queryBuilder, value);
      },
      journalEntry($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_journal_entryPgResource, journalEntryIdentifier, registryConfig.pgRelations.cryptoLot.journalEntryByMyJournalEntryId.localAttributes, registryConfig.pgRelations.cryptoLot.journalEntryByMyJournalEntryId.remoteAttributes, $where, value);
      },
      journalEntryExists($where, value) {
        return pgConnectionFilterApplyForwardRelationExists(resource_journal_entryPgResource, journalEntryIdentifier, registryConfig.pgRelations.cryptoLot.journalEntryByMyJournalEntryId.localAttributes, registryConfig.pgRelations.cryptoLot.journalEntryByMyJournalEntryId.remoteAttributes, $where, value);
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_cryptoLot.attributes.id, queryBuilder, value);
      }
    }
  },
  CryptoLotInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      acquiredAt: CryptoLotInput_acquiredAtApply,
      costPerUnit: CryptoLotInput_costPerUnitApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      cryptoAssetId: CryptoLotInput_cryptoAssetIdApply,
      disposedAt: CryptoLotInput_disposedAtApply,
      journalEntryId: JournalLineInput_journalEntryIdApply,
      proceedsPerUnit: CryptoLotInput_proceedsPerUnitApply,
      quantity: CryptoLotInput_quantityApply,
      remainingQuantity: CryptoLotInput_remainingQuantityApply,
      rowId: _DrizzleMigrationInput_rowIdApply
    }
  },
  CryptoLotPatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      acquiredAt: CryptoLotInput_acquiredAtApply,
      costPerUnit: CryptoLotInput_costPerUnitApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      cryptoAssetId: CryptoLotInput_cryptoAssetIdApply,
      disposedAt: CryptoLotInput_disposedAtApply,
      journalEntryId: JournalLineInput_journalEntryIdApply,
      proceedsPerUnit: CryptoLotInput_proceedsPerUnitApply,
      quantity: CryptoLotInput_quantityApply,
      remainingQuantity: CryptoLotInput_remainingQuantityApply,
      rowId: _DrizzleMigrationInput_rowIdApply
    }
  },
  DatetimeFilter: {
    plans: {
      distinctFrom: pgAggregatesApply_distinctFrom,
      equalTo: pgAggregatesApply_equalTo,
      greaterThan: pgAggregatesApply_greaterThan,
      greaterThanOrEqualTo: pgAggregatesApply_greaterThanOrEqualTo,
      in: pgAggregatesApply_in,
      isNull: pgAggregatesApply_isNull,
      lessThan: pgAggregatesApply_lessThan,
      lessThanOrEqualTo: pgAggregatesApply_lessThanOrEqualTo,
      notDistinctFrom: pgAggregatesApply_notDistinctFrom,
      notEqualTo: pgAggregatesApply_notEqualTo,
      notIn: pgAggregatesApply_notIn
    }
  },
  DeleteAccountByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteAccountingPeriodByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteAccountingPeriodInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteAccountInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteAccountMappingByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteAccountMappingInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteBookByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteBookInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteBudgetByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteBudgetInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteCategorizationRuleByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteCategorizationRuleInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteConnectedAccountByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteConnectedAccountInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteCryptoAssetByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteCryptoAssetInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteCryptoLotByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteCryptoLotInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteDrizzleMigrationByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteDrizzleMigrationInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteFixedAssetByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteFixedAssetInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteJournalEntryByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteJournalEntryInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteJournalLineByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteJournalLineInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteNetWorthSnapshotByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteNetWorthSnapshotInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteReconciliationQueueByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteReconciliationQueueInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteRecurringTransactionByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteRecurringTransactionInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteSavingsGoalByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  DeleteSavingsGoalInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate
    }
  },
  FixedAssetCondition: {
    plans: {
      bookId: AccountCondition_bookIdApply,
      disposedAt($condition, val) {
        return applyAttributeCondition("disposed_at", TYPES.text, $condition, val);
      },
      rowId: AccountCondition_rowIdApply
    }
  },
  FixedAssetFilter: {
    plans: {
      accumulatedDepreciationAccount($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.fixedAsset.accountByMyAccumulatedDepreciationAccountId.localAttributes, registryConfig.pgRelations.fixedAsset.accountByMyAccumulatedDepreciationAccountId.remoteAttributes, $where, value);
      },
      and: AccountFilter_andApply,
      assetAccount($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.fixedAsset.accountByMyAssetAccountId.localAttributes, registryConfig.pgRelations.fixedAsset.accountByMyAssetAccountId.remoteAttributes, $where, value);
      },
      book($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_bookPgResource, bookIdentifier, registryConfig.pgRelations.fixedAsset.bookByMyBookId.localAttributes, registryConfig.pgRelations.fixedAsset.bookByMyBookId.remoteAttributes, $where, value);
      },
      bookId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("bookId", "book_id", spec_fixedAsset.attributes.book_id, queryBuilder, value);
      },
      depreciationExpenseAccount($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.fixedAsset.accountByMyDepreciationExpenseAccountId.localAttributes, registryConfig.pgRelations.fixedAsset.accountByMyDepreciationExpenseAccountId.remoteAttributes, $where, value);
      },
      disposedAt(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("disposedAt", "disposed_at", spec_fixedAsset.attributes.disposed_at, queryBuilder, value);
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_fixedAsset.attributes.id, queryBuilder, value);
      }
    }
  },
  FixedAssetInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      accumulatedDepreciationAccountId: FixedAssetInput_accumulatedDepreciationAccountIdApply,
      acquisitionCost: FixedAssetInput_acquisitionCostApply,
      acquisitionDate: FixedAssetInput_acquisitionDateApply,
      assetAccountId: FixedAssetInput_assetAccountIdApply,
      bookId: AccountMappingInput_bookIdApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      depreciationExpenseAccountId: FixedAssetInput_depreciationExpenseAccountIdApply,
      depreciationMethod: FixedAssetInput_depreciationMethodApply,
      description: FixedAssetInput_descriptionApply,
      disposalProceeds: FixedAssetInput_disposalProceedsApply,
      disposedAt: CryptoLotInput_disposedAtApply,
      macrsClass: FixedAssetInput_macrsClassApply,
      name: SavingsGoalInput_nameApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      salvageValue: FixedAssetInput_salvageValueApply,
      usefulLifeMonths: FixedAssetInput_usefulLifeMonthsApply
    }
  },
  FixedAssetPatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      accumulatedDepreciationAccountId: FixedAssetInput_accumulatedDepreciationAccountIdApply,
      acquisitionCost: FixedAssetInput_acquisitionCostApply,
      acquisitionDate: FixedAssetInput_acquisitionDateApply,
      assetAccountId: FixedAssetInput_assetAccountIdApply,
      bookId: AccountMappingInput_bookIdApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      depreciationExpenseAccountId: FixedAssetInput_depreciationExpenseAccountIdApply,
      depreciationMethod: FixedAssetInput_depreciationMethodApply,
      description: FixedAssetInput_descriptionApply,
      disposalProceeds: FixedAssetInput_disposalProceedsApply,
      disposedAt: CryptoLotInput_disposedAtApply,
      macrsClass: FixedAssetInput_macrsClassApply,
      name: SavingsGoalInput_nameApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      salvageValue: FixedAssetInput_salvageValueApply,
      usefulLifeMonths: FixedAssetInput_usefulLifeMonthsApply
    }
  },
  IntFilter: {
    plans: {
      distinctFrom: pgAggregatesApply_distinctFrom,
      equalTo: pgAggregatesApply_equalTo,
      greaterThan: pgAggregatesApply_greaterThan,
      greaterThanOrEqualTo: pgAggregatesApply_greaterThanOrEqualTo,
      in: pgAggregatesApply_in,
      isNull: pgAggregatesApply_isNull,
      lessThan: pgAggregatesApply_lessThan,
      lessThanOrEqualTo: pgAggregatesApply_lessThanOrEqualTo,
      notDistinctFrom: pgAggregatesApply_notDistinctFrom,
      notEqualTo: pgAggregatesApply_notEqualTo,
      notIn: pgAggregatesApply_notIn
    }
  },
  JournalEntryCondition: {
    plans: {
      bookId: AccountCondition_bookIdApply,
      date: JournalEntryCondition_dateApply,
      rowId: AccountCondition_rowIdApply,
      source($condition, val) {
        return applyAttributeCondition("source", journalEntrySourceCodec, $condition, val);
      },
      sourceReferenceId($condition, val) {
        return applyAttributeCondition("source_reference_id", TYPES.text, $condition, val);
      }
    }
  },
  JournalEntryFilter: {
    plans: {
      and: AccountFilter_andApply,
      book($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_bookPgResource, bookIdentifier, registryConfig.pgRelations.journalEntry.bookByMyBookId.localAttributes, registryConfig.pgRelations.journalEntry.bookByMyBookId.remoteAttributes, $where, value);
      },
      bookId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("bookId", "book_id", spec_journalEntry.attributes.book_id, queryBuilder, value);
      },
      date(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("date", "date", spec_journalEntry.attributes.date, queryBuilder, value);
      },
      journalLines($where, value) {
        assertAllowed(value, "object");
        const $rel = $where.andPlan();
        $rel.extensions.pgFilterRelation = {
          tableExpression: journalLineIdentifier,
          alias: resource_journal_linePgResource.name,
          localAttributes: registryConfig.pgRelations.journalEntry.journalLinesByTheirJournalEntryId.localAttributes,
          remoteAttributes: registryConfig.pgRelations.journalEntry.journalLinesByTheirJournalEntryId.remoteAttributes
        };
        return $rel;
      },
      journalLinesExist($where, value) {
        assertAllowed(value, "scalar");
        if (value == null) return;
        const $subQuery = $where.existsPlan({
          tableExpression: journalLineIdentifier,
          alias: resource_journal_linePgResource.name,
          equals: value
        });
        registryConfig.pgRelations.journalEntry.journalLinesByTheirJournalEntryId.localAttributes.forEach((localAttribute, i) => {
          const remoteAttribute = registryConfig.pgRelations.journalEntry.journalLinesByTheirJournalEntryId.remoteAttributes[i];
          $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
        });
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_journalEntry.attributes.id, queryBuilder, value);
      },
      source(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("source", "source", spec_journalEntry.attributes.source, queryBuilder, value);
      },
      sourceReferenceId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("sourceReferenceId", "source_reference_id", spec_journalEntry.attributes.source_reference_id, queryBuilder, value);
      }
    }
  },
  JournalEntryInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      bookId: AccountMappingInput_bookIdApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      date: NetWorthSnapshotInput_dateApply,
      isReconciled: JournalEntryInput_isReconciledApply,
      isReviewed: JournalEntryInput_isReviewedApply,
      memo: JournalLineInput_memoApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      source: JournalEntryInput_sourceApply,
      sourceReferenceId: JournalEntryInput_sourceReferenceIdApply,
      updatedAt: AccountMappingInput_updatedAtApply
    }
  },
  JournalEntryPatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      bookId: AccountMappingInput_bookIdApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      date: NetWorthSnapshotInput_dateApply,
      isReconciled: JournalEntryInput_isReconciledApply,
      isReviewed: JournalEntryInput_isReviewedApply,
      memo: JournalLineInput_memoApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      source: JournalEntryInput_sourceApply,
      sourceReferenceId: JournalEntryInput_sourceReferenceIdApply,
      updatedAt: AccountMappingInput_updatedAtApply
    }
  },
  JournalEntrySourceFilter: {
    plans: {
      distinctFrom: pgAggregatesApply_distinctFrom,
      equalTo: pgAggregatesApply_equalTo,
      greaterThan: pgAggregatesApply_greaterThan,
      greaterThanOrEqualTo: pgAggregatesApply_greaterThanOrEqualTo,
      in: pgAggregatesApply_in,
      isNull: pgAggregatesApply_isNull,
      lessThan: pgAggregatesApply_lessThan,
      lessThanOrEqualTo: pgAggregatesApply_lessThanOrEqualTo,
      notDistinctFrom: pgAggregatesApply_notDistinctFrom,
      notEqualTo: pgAggregatesApply_notEqualTo,
      notIn: pgAggregatesApply_notIn
    }
  },
  JournalEntryToManyJournalLineFilter: {
    plans: {
      every: AccountToManyAccountFilter_everyApply,
      none: AccountToManyAccountFilter_noneApply,
      some: AccountToManyAccountFilter_someApply
    }
  },
  JournalLineCondition: {
    plans: {
      accountId: BudgetCondition_accountIdApply,
      journalEntryId($condition, val) {
        return applyAttributeCondition("journal_entry_id", TYPES.uuid, $condition, val);
      },
      rowId: AccountCondition_rowIdApply
    }
  },
  JournalLineFilter: {
    plans: {
      account($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.journalLine.accountByMyAccountId.localAttributes, registryConfig.pgRelations.journalLine.accountByMyAccountId.remoteAttributes, $where, value);
      },
      accountId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("accountId", "account_id", spec_journalLine.attributes.account_id, queryBuilder, value);
      },
      and: AccountFilter_andApply,
      journalEntry($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_journal_entryPgResource, journalEntryIdentifier, registryConfig.pgRelations.journalLine.journalEntryByMyJournalEntryId.localAttributes, registryConfig.pgRelations.journalLine.journalEntryByMyJournalEntryId.remoteAttributes, $where, value);
      },
      journalEntryId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("journalEntryId", "journal_entry_id", spec_journalLine.attributes.journal_entry_id, queryBuilder, value);
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_journalLine.attributes.id, queryBuilder, value);
      }
    }
  },
  JournalLineInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      accountId: JournalLineInput_accountIdApply,
      credit: JournalLineInput_creditApply,
      debit: JournalLineInput_debitApply,
      journalEntryId: JournalLineInput_journalEntryIdApply,
      memo: JournalLineInput_memoApply,
      rowId: _DrizzleMigrationInput_rowIdApply
    }
  },
  JournalLinePatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      accountId: JournalLineInput_accountIdApply,
      credit: JournalLineInput_creditApply,
      debit: JournalLineInput_debitApply,
      journalEntryId: JournalLineInput_journalEntryIdApply,
      memo: JournalLineInput_memoApply,
      rowId: _DrizzleMigrationInput_rowIdApply
    }
  },
  NetWorthSnapshotCondition: {
    plans: {
      bookId: AccountCondition_bookIdApply,
      date: JournalEntryCondition_dateApply,
      rowId: AccountCondition_rowIdApply
    }
  },
  NetWorthSnapshotFilter: {
    plans: {
      and: AccountFilter_andApply,
      book($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_bookPgResource, bookIdentifier, registryConfig.pgRelations.netWorthSnapshot.bookByMyBookId.localAttributes, registryConfig.pgRelations.netWorthSnapshot.bookByMyBookId.remoteAttributes, $where, value);
      },
      bookId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("bookId", "book_id", spec_netWorthSnapshot.attributes.book_id, queryBuilder, value);
      },
      date(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("date", "date", spec_netWorthSnapshot.attributes.date, queryBuilder, value);
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_netWorthSnapshot.attributes.id, queryBuilder, value);
      }
    }
  },
  NetWorthSnapshotInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      bookId: AccountMappingInput_bookIdApply,
      breakdown: NetWorthSnapshotInput_breakdownApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      date: NetWorthSnapshotInput_dateApply,
      netWorth: NetWorthSnapshotInput_netWorthApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      totalAssets: NetWorthSnapshotInput_totalAssetsApply,
      totalLiabilities: NetWorthSnapshotInput_totalLiabilitiesApply
    }
  },
  NetWorthSnapshotPatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      bookId: AccountMappingInput_bookIdApply,
      breakdown: NetWorthSnapshotInput_breakdownApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      date: NetWorthSnapshotInput_dateApply,
      netWorth: NetWorthSnapshotInput_netWorthApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      totalAssets: NetWorthSnapshotInput_totalAssetsApply,
      totalLiabilities: NetWorthSnapshotInput_totalLiabilitiesApply
    }
  },
  ReconciliationQueueCondition: {
    plans: {
      bookId: AccountCondition_bookIdApply,
      rowId: AccountCondition_rowIdApply,
      status($condition, val) {
        return applyAttributeCondition("status", reconciliationStatusCodec, $condition, val);
      }
    }
  },
  ReconciliationQueueFilter: {
    plans: {
      and: AccountFilter_andApply,
      book($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_bookPgResource, bookIdentifier, registryConfig.pgRelations.reconciliationQueue.bookByMyBookId.localAttributes, registryConfig.pgRelations.reconciliationQueue.bookByMyBookId.remoteAttributes, $where, value);
      },
      bookId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("bookId", "book_id", spec_reconciliationQueue.attributes.book_id, queryBuilder, value);
      },
      journalEntry($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_journal_entryPgResource, journalEntryIdentifier, registryConfig.pgRelations.reconciliationQueue.journalEntryByMyJournalEntryId.localAttributes, registryConfig.pgRelations.reconciliationQueue.journalEntryByMyJournalEntryId.remoteAttributes, $where, value);
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_reconciliationQueue.attributes.id, queryBuilder, value);
      },
      status(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("status", "status", spec_reconciliationQueue.attributes.status, queryBuilder, value);
      },
      suggestedCreditAccount($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.reconciliationQueue.accountByMySuggestedCreditAccountId.localAttributes, registryConfig.pgRelations.reconciliationQueue.accountByMySuggestedCreditAccountId.remoteAttributes, $where, value);
      },
      suggestedCreditAccountExists($where, value) {
        return pgConnectionFilterApplyForwardRelationExists(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.reconciliationQueue.accountByMySuggestedCreditAccountId.localAttributes, registryConfig.pgRelations.reconciliationQueue.accountByMySuggestedCreditAccountId.remoteAttributes, $where, value);
      },
      suggestedDebitAccount($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.reconciliationQueue.accountByMySuggestedDebitAccountId.localAttributes, registryConfig.pgRelations.reconciliationQueue.accountByMySuggestedDebitAccountId.remoteAttributes, $where, value);
      },
      suggestedDebitAccountExists($where, value) {
        return pgConnectionFilterApplyForwardRelationExists(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.reconciliationQueue.accountByMySuggestedDebitAccountId.localAttributes, registryConfig.pgRelations.reconciliationQueue.accountByMySuggestedDebitAccountId.remoteAttributes, $where, value);
      }
    }
  },
  ReconciliationQueueInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      bookId: AccountMappingInput_bookIdApply,
      categorizationSource: ReconciliationQueueInput_categorizationSourceApply,
      confidence: CategorizationRuleInput_confidenceApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      journalEntryId: JournalLineInput_journalEntryIdApply,
      periodMonth: ReconciliationQueueInput_periodMonthApply,
      periodYear: ReconciliationQueueInput_periodYearApply,
      priority: CategorizationRuleInput_priorityApply,
      reviewedAt: ReconciliationQueueInput_reviewedAtApply,
      reviewedBy: ReconciliationQueueInput_reviewedByApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      status: AccountingPeriodInput_statusApply,
      suggestedCreditAccountId: ReconciliationQueueInput_suggestedCreditAccountIdApply,
      suggestedDebitAccountId: ReconciliationQueueInput_suggestedDebitAccountIdApply
    }
  },
  ReconciliationQueuePatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      bookId: AccountMappingInput_bookIdApply,
      categorizationSource: ReconciliationQueueInput_categorizationSourceApply,
      confidence: CategorizationRuleInput_confidenceApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      journalEntryId: JournalLineInput_journalEntryIdApply,
      periodMonth: ReconciliationQueueInput_periodMonthApply,
      periodYear: ReconciliationQueueInput_periodYearApply,
      priority: CategorizationRuleInput_priorityApply,
      reviewedAt: ReconciliationQueueInput_reviewedAtApply,
      reviewedBy: ReconciliationQueueInput_reviewedByApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      status: AccountingPeriodInput_statusApply,
      suggestedCreditAccountId: ReconciliationQueueInput_suggestedCreditAccountIdApply,
      suggestedDebitAccountId: ReconciliationQueueInput_suggestedDebitAccountIdApply
    }
  },
  ReconciliationStatusFilter: {
    plans: {
      distinctFrom: pgAggregatesApply_distinctFrom,
      equalTo: pgAggregatesApply_equalTo,
      greaterThan: pgAggregatesApply_greaterThan,
      greaterThanOrEqualTo: pgAggregatesApply_greaterThanOrEqualTo,
      in: pgAggregatesApply_in,
      isNull: pgAggregatesApply_isNull,
      lessThan: pgAggregatesApply_lessThan,
      lessThanOrEqualTo: pgAggregatesApply_lessThanOrEqualTo,
      notDistinctFrom: pgAggregatesApply_notDistinctFrom,
      notEqualTo: pgAggregatesApply_notEqualTo,
      notIn: pgAggregatesApply_notIn
    }
  },
  RecurringTransactionCondition: {
    plans: {
      bookId: AccountCondition_bookIdApply,
      rowId: AccountCondition_rowIdApply
    }
  },
  RecurringTransactionFilter: {
    plans: {
      account($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.recurringTransaction.accountByMyAccountId.localAttributes, registryConfig.pgRelations.recurringTransaction.accountByMyAccountId.remoteAttributes, $where, value);
      },
      and: AccountFilter_andApply,
      book($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_bookPgResource, bookIdentifier, registryConfig.pgRelations.recurringTransaction.bookByMyBookId.localAttributes, registryConfig.pgRelations.recurringTransaction.bookByMyBookId.remoteAttributes, $where, value);
      },
      bookId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("bookId", "book_id", spec_recurringTransaction.attributes.book_id, queryBuilder, value);
      },
      counterAccount($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.recurringTransaction.accountByMyCounterAccountId.localAttributes, registryConfig.pgRelations.recurringTransaction.accountByMyCounterAccountId.remoteAttributes, $where, value);
      },
      counterAccountExists($where, value) {
        return pgConnectionFilterApplyForwardRelationExists(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.recurringTransaction.accountByMyCounterAccountId.localAttributes, registryConfig.pgRelations.recurringTransaction.accountByMyCounterAccountId.remoteAttributes, $where, value);
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_recurringTransaction.attributes.id, queryBuilder, value);
      }
    }
  },
  RecurringTransactionInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      accountId: JournalLineInput_accountIdApply,
      amount: BudgetInput_amountApply,
      bookId: AccountMappingInput_bookIdApply,
      counterAccountId: RecurringTransactionInput_counterAccountIdApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      frequency: RecurringTransactionInput_frequencyApply,
      isActive: RecurringTransactionInput_isActiveApply,
      isAutoDetected: RecurringTransactionInput_isAutoDetectedApply,
      name: SavingsGoalInput_nameApply,
      nextExpectedDate: RecurringTransactionInput_nextExpectedDateApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      updatedAt: AccountMappingInput_updatedAtApply
    }
  },
  RecurringTransactionPatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      accountId: JournalLineInput_accountIdApply,
      amount: BudgetInput_amountApply,
      bookId: AccountMappingInput_bookIdApply,
      counterAccountId: RecurringTransactionInput_counterAccountIdApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      frequency: RecurringTransactionInput_frequencyApply,
      isActive: RecurringTransactionInput_isActiveApply,
      isAutoDetected: RecurringTransactionInput_isAutoDetectedApply,
      name: SavingsGoalInput_nameApply,
      nextExpectedDate: RecurringTransactionInput_nextExpectedDateApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      updatedAt: AccountMappingInput_updatedAtApply
    }
  },
  SavingsGoalCondition: {
    plans: {
      bookId: AccountCondition_bookIdApply,
      rowId: AccountCondition_rowIdApply
    }
  },
  SavingsGoalFilter: {
    plans: {
      account($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_accountPgResource, accountIdentifier, registryConfig.pgRelations.savingsGoal.accountByMyAccountId.localAttributes, registryConfig.pgRelations.savingsGoal.accountByMyAccountId.remoteAttributes, $where, value);
      },
      and: AccountFilter_andApply,
      book($where, value) {
        return pgConnectionFilterApplySingleRelation(resource_bookPgResource, bookIdentifier, registryConfig.pgRelations.savingsGoal.bookByMyBookId.localAttributes, registryConfig.pgRelations.savingsGoal.bookByMyBookId.remoteAttributes, $where, value);
      },
      bookId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("bookId", "book_id", spec_savingsGoal.attributes.book_id, queryBuilder, value);
      },
      not: AccountFilter_notApply,
      or: AccountFilter_orApply,
      rowId(queryBuilder, value) {
        return pgConnectionFilterApplyAttribute("rowId", "id", spec_savingsGoal.attributes.id, queryBuilder, value);
      }
    }
  },
  SavingsGoalInput: {
    baked: createObjectAndApplyChildren,
    plans: {
      accountId: JournalLineInput_accountIdApply,
      bookId: AccountMappingInput_bookIdApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      name: SavingsGoalInput_nameApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      targetAmount: SavingsGoalInput_targetAmountApply,
      targetDate: SavingsGoalInput_targetDateApply,
      updatedAt: AccountMappingInput_updatedAtApply
    }
  },
  SavingsGoalPatch: {
    baked: createObjectAndApplyChildren,
    plans: {
      accountId: JournalLineInput_accountIdApply,
      bookId: AccountMappingInput_bookIdApply,
      createdAt: _DrizzleMigrationInput_createdAtApply,
      name: SavingsGoalInput_nameApply,
      rowId: _DrizzleMigrationInput_rowIdApply,
      targetAmount: SavingsGoalInput_targetAmountApply,
      targetDate: SavingsGoalInput_targetDateApply,
      updatedAt: AccountMappingInput_updatedAtApply
    }
  },
  StringFilter: {
    plans: {
      distinctFrom: pgAggregatesApply_distinctFrom,
      distinctFromInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("distinctFromInsensitive", resolveDistinct, undefined, resolveInputCodecInsensitiveOperator, resolveSqlIdentifierInsensitiveOperator, resolveSqlValueInsensitiveOperator, $where, value);
      },
      endsWith($where, value) {
        return pgConnectionFilterApplyFromOperator("endsWith", resolveLike, resolveInputEndsWith, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
      },
      endsWithInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("endsWithInsensitive", resolveILike, resolveInputEndsWith, resolveInputCodecInsensitive, resolveSqlIdentifierInsensitive, undefined, $where, value);
      },
      equalTo: pgAggregatesApply_equalTo,
      equalToInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("equalToInsensitive", resolveEquality, undefined, resolveInputCodecInsensitiveOperator, resolveSqlIdentifierInsensitiveOperator, resolveSqlValueInsensitiveOperator, $where, value);
      },
      greaterThan: pgAggregatesApply_greaterThan,
      greaterThanInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("greaterThanInsensitive", resolveGreaterThan, undefined, resolveInputCodecInsensitiveOperator, resolveSqlIdentifierInsensitiveOperator, resolveSqlValueInsensitiveOperator, $where, value);
      },
      greaterThanOrEqualTo: pgAggregatesApply_greaterThanOrEqualTo,
      greaterThanOrEqualToInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("greaterThanOrEqualToInsensitive", resolveGreaterThanOrEqualTo, undefined, resolveInputCodecInsensitiveOperator, resolveSqlIdentifierInsensitiveOperator, resolveSqlValueInsensitiveOperator, $where, value);
      },
      in: pgAggregatesApply_in,
      includes($where, value) {
        return pgConnectionFilterApplyFromOperator("includes", resolveLike, resolveInputContains, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
      },
      includesInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("includesInsensitive", resolveILike, resolveInputContains, resolveInputCodecInsensitive, resolveSqlIdentifierInsensitive, undefined, $where, value);
      },
      inInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("inInsensitive", resolveEqualsAny, undefined, resolveInputCodecInsensitiveOperator_list, resolveSqlIdentifierInsensitiveOperator, resolveSqlValueInsensitiveOperator_list, $where, value);
      },
      isNull: pgAggregatesApply_isNull,
      lessThan: pgAggregatesApply_lessThan,
      lessThanInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("lessThanInsensitive", resolveLessThan, undefined, resolveInputCodecInsensitiveOperator, resolveSqlIdentifierInsensitiveOperator, resolveSqlValueInsensitiveOperator, $where, value);
      },
      lessThanOrEqualTo: pgAggregatesApply_lessThanOrEqualTo,
      lessThanOrEqualToInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("lessThanOrEqualToInsensitive", resolveLessThanOrEqualTo, undefined, resolveInputCodecInsensitiveOperator, resolveSqlIdentifierInsensitiveOperator, resolveSqlValueInsensitiveOperator, $where, value);
      },
      like($where, value) {
        return pgConnectionFilterApplyFromOperator("like", resolveLike, undefined, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
      },
      likeInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("likeInsensitive", resolveILike, undefined, resolveInputCodecInsensitive, resolveSqlIdentifierInsensitive, undefined, $where, value);
      },
      notDistinctFrom: pgAggregatesApply_notDistinctFrom,
      notDistinctFromInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("notDistinctFromInsensitive", resolveNotDistinct, undefined, resolveInputCodecInsensitiveOperator, resolveSqlIdentifierInsensitiveOperator, resolveSqlValueInsensitiveOperator, $where, value);
      },
      notEndsWith($where, value) {
        return pgConnectionFilterApplyFromOperator("notEndsWith", resolveNotLike, resolveInputEndsWith, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
      },
      notEndsWithInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("notEndsWithInsensitive", resolveNotILike, resolveInputEndsWith, resolveInputCodecInsensitive, resolveSqlIdentifierInsensitive, undefined, $where, value);
      },
      notEqualTo: pgAggregatesApply_notEqualTo,
      notEqualToInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("notEqualToInsensitive", resolveInequality, undefined, resolveInputCodecInsensitiveOperator, resolveSqlIdentifierInsensitiveOperator, resolveSqlValueInsensitiveOperator, $where, value);
      },
      notIn: pgAggregatesApply_notIn,
      notIncludes($where, value) {
        return pgConnectionFilterApplyFromOperator("notIncludes", resolveNotLike, resolveInputContains, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
      },
      notIncludesInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("notIncludesInsensitive", resolveNotILike, resolveInputContains, resolveInputCodecInsensitive, resolveSqlIdentifierInsensitive, undefined, $where, value);
      },
      notInInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("notInInsensitive", resolveInequalAll, undefined, resolveInputCodecInsensitiveOperator_list, resolveSqlIdentifierInsensitiveOperator, resolveSqlValueInsensitiveOperator_list, $where, value);
      },
      notLike($where, value) {
        return pgConnectionFilterApplyFromOperator("notLike", resolveNotLike, undefined, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
      },
      notLikeInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("notLikeInsensitive", resolveNotILike, undefined, resolveInputCodecInsensitive, resolveSqlIdentifierInsensitive, undefined, $where, value);
      },
      notStartsWith($where, value) {
        return pgConnectionFilterApplyFromOperator("notStartsWith", resolveNotLike, resolveInputStartsWith, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
      },
      notStartsWithInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("notStartsWithInsensitive", resolveNotILike, resolveInputStartsWith, resolveInputCodecInsensitive, resolveSqlIdentifierInsensitive, undefined, $where, value);
      },
      startsWith($where, value) {
        return pgConnectionFilterApplyFromOperator("startsWith", resolveLike, resolveInputStartsWith, resolveInputCodecSensitive, resolveSqlIdentifierSensitive, undefined, $where, value);
      },
      startsWithInsensitive($where, value) {
        return pgConnectionFilterApplyFromOperator("startsWithInsensitive", resolveILike, resolveInputStartsWith, resolveInputCodecInsensitive, resolveSqlIdentifierInsensitive, undefined, $where, value);
      }
    }
  },
  UpdateAccountByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateAccountingPeriodByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateAccountingPeriodInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateAccountInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateAccountMappingByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateAccountMappingInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateBookByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateBookInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateBudgetByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateBudgetInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateCategorizationRuleByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateCategorizationRuleInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateConnectedAccountByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateConnectedAccountInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateCryptoAssetByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateCryptoAssetInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateCryptoLotByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateCryptoLotInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateDrizzleMigrationByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateDrizzleMigrationInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateFixedAssetByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateFixedAssetInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateJournalEntryByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateJournalEntryInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateJournalLineByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateJournalLineInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateNetWorthSnapshotByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateNetWorthSnapshotInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateReconciliationQueueByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateReconciliationQueueInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateRecurringTransactionByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateRecurringTransactionInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateSavingsGoalByIdInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UpdateSavingsGoalInput: {
    plans: {
      clientMutationId: applyClientMutationIdForCreate,
      patch: applyCreateFields
    }
  },
  UUIDFilter: {
    plans: {
      distinctFrom: pgAggregatesApply_distinctFrom,
      equalTo: pgAggregatesApply_equalTo,
      greaterThan: pgAggregatesApply_greaterThan,
      greaterThanOrEqualTo: pgAggregatesApply_greaterThanOrEqualTo,
      in: pgAggregatesApply_in,
      isNull: pgAggregatesApply_isNull,
      lessThan: pgAggregatesApply_lessThan,
      lessThanOrEqualTo: pgAggregatesApply_lessThanOrEqualTo,
      notDistinctFrom: pgAggregatesApply_notDistinctFrom,
      notEqualTo: pgAggregatesApply_notEqualTo,
      notIn: pgAggregatesApply_notIn
    }
  }
};
export const scalars = {
  BigFloat: {
    serialize: toString,
    parseValue: toString,
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) return ast.value;
      throw new GraphQLError(`BigFloat can only parse string values (kind='${ast.kind}')`);
    }
  },
  BigInt: {
    serialize: toString,
    parseValue: toString,
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) return ast.value;
      throw new GraphQLError(`BigInt can only parse string values (kind='${ast.kind}')`);
    }
  },
  Cursor: {
    serialize: toString,
    parseValue: toString,
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) return ast.value;
      throw new GraphQLError(`Cursor can only parse string values (kind='${ast.kind}')`);
    }
  },
  Datetime: {
    serialize: toString,
    parseValue: toString,
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) return ast.value;
      throw new GraphQLError(`Datetime can only parse string values (kind='${ast.kind}')`);
    }
  },
  JSON: {
    serialize: JSONSerialize,
    parseValue: JSONSerialize,
    parseLiteral: (() => {
      const parseLiteralToObject = (ast, variables) => {
        switch (ast.kind) {
          case Kind.STRING:
          case Kind.BOOLEAN:
            return ast.value;
          case Kind.INT:
          case Kind.FLOAT:
            return parseFloat(ast.value);
          case Kind.OBJECT:
            {
              const value = Object.create(null);
              ast.fields.forEach(field => {
                value[field.name.value] = parseLiteralToObject(field.value, variables);
              });
              return value;
            }
          case Kind.LIST:
            return ast.values.map(n => parseLiteralToObject(n, variables));
          case Kind.NULL:
            return null;
          case Kind.VARIABLE:
            {
              const name = ast.name.value;
              return variables ? variables[name] : void 0;
            }
          default:
            return;
        }
      };
      return parseLiteralToObject;
    })()
  },
  UUID: {
    serialize: toString,
    parseValue(value) {
      return coerce("" + value);
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) return coerce(ast.value);
      throw new GraphQLError(`UUID can only parse string values (kind = '${ast.kind}')`);
    }
  }
};
export const enums = {
  _DrizzleMigrationOrderBy: {
    values: {
      PRIMARY_KEY_ASC(queryBuilder) {
        __drizzle_migrationsUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        __drizzle_migrationsUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply
    }
  },
  AccountingPeriodOrderBy: {
    values: {
      BOOK_ID_ASC: AccountOrderBy_BOOK_ID_ASCApply,
      BOOK_ID_DESC: AccountOrderBy_BOOK_ID_DESCApply,
      MONTH_ASC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "month",
          direction: "ASC"
        });
      },
      MONTH_DESC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "month",
          direction: "DESC"
        });
      },
      PRIMARY_KEY_ASC(queryBuilder) {
        accounting_periodUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        accounting_periodUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply,
      STATUS_ASC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "status",
          direction: "ASC"
        });
      },
      STATUS_DESC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "status",
          direction: "DESC"
        });
      },
      YEAR_ASC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "year",
          direction: "ASC"
        });
      },
      YEAR_DESC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "year",
          direction: "DESC"
        });
      }
    }
  },
  AccountMappingOrderBy: {
    values: {
      BOOK_ID_ASC: AccountOrderBy_BOOK_ID_ASCApply,
      BOOK_ID_DESC: AccountOrderBy_BOOK_ID_DESCApply,
      EVENT_TYPE_ASC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "event_type",
          direction: "ASC"
        });
      },
      EVENT_TYPE_DESC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "event_type",
          direction: "DESC"
        });
      },
      PRIMARY_KEY_ASC(queryBuilder) {
        account_mappingUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        account_mappingUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply
    }
  },
  AccountOrderBy: {
    values: {
      BOOK_ID_ASC: AccountOrderBy_BOOK_ID_ASCApply,
      BOOK_ID_DESC: AccountOrderBy_BOOK_ID_DESCApply,
      PARENT_ID_ASC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "parent_id",
          direction: "ASC"
        });
      },
      PARENT_ID_DESC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "parent_id",
          direction: "DESC"
        });
      },
      PRIMARY_KEY_ASC(queryBuilder) {
        accountUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        accountUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply
    }
  },
  BookOrderBy: {
    values: {
      ORGANIZATION_ID_ASC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "organization_id",
          direction: "ASC"
        });
      },
      ORGANIZATION_ID_DESC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "organization_id",
          direction: "DESC"
        });
      },
      PRIMARY_KEY_ASC(queryBuilder) {
        bookUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        bookUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply
    }
  },
  BudgetOrderBy: {
    values: {
      ACCOUNT_ID_ASC: BudgetOrderBy_ACCOUNT_ID_ASCApply,
      ACCOUNT_ID_DESC: BudgetOrderBy_ACCOUNT_ID_DESCApply,
      BOOK_ID_ASC: AccountOrderBy_BOOK_ID_ASCApply,
      BOOK_ID_DESC: AccountOrderBy_BOOK_ID_DESCApply,
      PRIMARY_KEY_ASC(queryBuilder) {
        budgetUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        budgetUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply
    }
  },
  CategorizationRuleOrderBy: {
    values: {
      BOOK_ID_ASC: AccountOrderBy_BOOK_ID_ASCApply,
      BOOK_ID_DESC: AccountOrderBy_BOOK_ID_DESCApply,
      MATCH_FIELD_ASC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "match_field",
          direction: "ASC"
        });
      },
      MATCH_FIELD_DESC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "match_field",
          direction: "DESC"
        });
      },
      PRIMARY_KEY_ASC(queryBuilder) {
        categorization_ruleUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        categorization_ruleUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply
    }
  },
  ConnectedAccountOrderBy: {
    values: {
      BOOK_ID_ASC: AccountOrderBy_BOOK_ID_ASCApply,
      BOOK_ID_DESC: AccountOrderBy_BOOK_ID_DESCApply,
      PRIMARY_KEY_ASC(queryBuilder) {
        connected_accountUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        connected_accountUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply
    }
  },
  CryptoAssetOrderBy: {
    values: {
      BOOK_ID_ASC: AccountOrderBy_BOOK_ID_ASCApply,
      BOOK_ID_DESC: AccountOrderBy_BOOK_ID_DESCApply,
      PRIMARY_KEY_ASC(queryBuilder) {
        crypto_assetUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        crypto_assetUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply,
      SYMBOL_ASC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "symbol",
          direction: "ASC"
        });
      },
      SYMBOL_DESC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "symbol",
          direction: "DESC"
        });
      }
    }
  },
  CryptoLotOrderBy: {
    values: {
      CRYPTO_ASSET_ID_ASC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "crypto_asset_id",
          direction: "ASC"
        });
      },
      CRYPTO_ASSET_ID_DESC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "crypto_asset_id",
          direction: "DESC"
        });
      },
      PRIMARY_KEY_ASC(queryBuilder) {
        crypto_lotUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        crypto_lotUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply
    }
  },
  FixedAssetOrderBy: {
    values: {
      BOOK_ID_ASC: AccountOrderBy_BOOK_ID_ASCApply,
      BOOK_ID_DESC: AccountOrderBy_BOOK_ID_DESCApply,
      DISPOSED_AT_ASC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "disposed_at",
          direction: "ASC"
        });
      },
      DISPOSED_AT_DESC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "disposed_at",
          direction: "DESC"
        });
      },
      PRIMARY_KEY_ASC(queryBuilder) {
        fixed_assetUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        fixed_assetUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply
    }
  },
  JournalEntryOrderBy: {
    values: {
      BOOK_ID_ASC: AccountOrderBy_BOOK_ID_ASCApply,
      BOOK_ID_DESC: AccountOrderBy_BOOK_ID_DESCApply,
      DATE_ASC: JournalEntryOrderBy_DATE_ASCApply,
      DATE_DESC: JournalEntryOrderBy_DATE_DESCApply,
      PRIMARY_KEY_ASC(queryBuilder) {
        journal_entryUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        journal_entryUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply,
      SOURCE_REFERENCE_ID_ASC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "source_reference_id",
          direction: "ASC"
        });
      },
      SOURCE_REFERENCE_ID_DESC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "source_reference_id",
          direction: "DESC"
        });
      }
    }
  },
  JournalLineOrderBy: {
    values: {
      ACCOUNT_ID_ASC: BudgetOrderBy_ACCOUNT_ID_ASCApply,
      ACCOUNT_ID_DESC: BudgetOrderBy_ACCOUNT_ID_DESCApply,
      JOURNAL_ENTRY_ID_ASC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "journal_entry_id",
          direction: "ASC"
        });
      },
      JOURNAL_ENTRY_ID_DESC(queryBuilder) {
        queryBuilder.orderBy({
          attribute: "journal_entry_id",
          direction: "DESC"
        });
      },
      PRIMARY_KEY_ASC(queryBuilder) {
        journal_lineUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        journal_lineUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply
    }
  },
  NetWorthSnapshotOrderBy: {
    values: {
      BOOK_ID_ASC: AccountOrderBy_BOOK_ID_ASCApply,
      BOOK_ID_DESC: AccountOrderBy_BOOK_ID_DESCApply,
      DATE_ASC: JournalEntryOrderBy_DATE_ASCApply,
      DATE_DESC: JournalEntryOrderBy_DATE_DESCApply,
      PRIMARY_KEY_ASC(queryBuilder) {
        net_worth_snapshotUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        net_worth_snapshotUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply
    }
  },
  ReconciliationQueueOrderBy: {
    values: {
      BOOK_ID_ASC: AccountOrderBy_BOOK_ID_ASCApply,
      BOOK_ID_DESC: AccountOrderBy_BOOK_ID_DESCApply,
      PRIMARY_KEY_ASC(queryBuilder) {
        reconciliation_queueUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        reconciliation_queueUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply
    }
  },
  RecurringTransactionOrderBy: {
    values: {
      BOOK_ID_ASC: AccountOrderBy_BOOK_ID_ASCApply,
      BOOK_ID_DESC: AccountOrderBy_BOOK_ID_DESCApply,
      PRIMARY_KEY_ASC(queryBuilder) {
        recurring_transactionUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        recurring_transactionUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply
    }
  },
  SavingsGoalOrderBy: {
    values: {
      BOOK_ID_ASC: AccountOrderBy_BOOK_ID_ASCApply,
      BOOK_ID_DESC: AccountOrderBy_BOOK_ID_DESCApply,
      PRIMARY_KEY_ASC(queryBuilder) {
        savings_goalUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "ASC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      PRIMARY_KEY_DESC(queryBuilder) {
        savings_goalUniques[0].attributes.forEach(attributeName => {
          queryBuilder.orderBy({
            attribute: attributeName,
            direction: "DESC"
          });
        });
        queryBuilder.setOrderIsUnique();
      },
      ROW_ID_ASC: AccountOrderBy_ROW_ID_ASCApply,
      ROW_ID_DESC: AccountOrderBy_ROW_ID_DESCApply
    }
  }
};
export const schema = makeGrafastSchema({
  typeDefs: typeDefs,
  objects: objects,
  interfaces: interfaces,
  inputObjects: inputObjects,
  scalars: scalars,
  enums: enums
});