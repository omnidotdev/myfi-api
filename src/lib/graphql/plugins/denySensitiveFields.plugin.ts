import { GraphQLError } from "graphql";

import type { ASTVisitor, ValidationRule } from "graphql";

/**
 * Field names that hold encrypted secrets (Plaid/OFX credential blobs, Gusto
 * OAuth tokens, vendor TINs, filer EINs). The Postgraphile schema is generated
 * straight from the tables, so these columns are otherwise selectable. Until the
 * schema is regenerated to omit them (and per-book tenant scoping is added),
 * reject any query that selects them.
 */
const SENSITIVE_FIELDS = new Set([
  "accessToken",
  "refreshToken",
  "taxId",
  "ein",
]);

/**
 * GraphQL validation rule that fails any operation selecting a sensitive field.
 * Runs at validation time, so it needs no schema regeneration and cannot break
 * server boot
 */
export const DenySensitiveFieldsRule: ValidationRule = (
  context,
): ASTVisitor => ({
  Field(node) {
    if (SENSITIVE_FIELDS.has(node.name.value)) {
      context.reportError(
        new GraphQLError(`Selecting "${node.name.value}" is not permitted`, {
          nodes: [node],
        }),
      );
    }
  },
});

/**
 * Envelop plugin wiring the rule into the GraphQL validation phase.
 */
const denySensitiveFieldsPlugin = {
  onValidate({
    addValidationRule,
  }: {
    addValidationRule: (rule: ValidationRule) => void;
  }) {
    addValidationRule(DenySensitiveFieldsRule);
  },
};

export default denySensitiveFieldsPlugin;
