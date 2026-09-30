import type { DocumentNode, FieldNode, OperationDefinitionNode } from "graphql";

// The only root query fields the app uses over GraphQL. Everything else in the
// auto-generated Postgraphile schema (e.g. allVendors, connectedAccounts) is an
// unscoped cross-tenant read surface, so it is not permitted here. Writes go
// through REST, so mutations/subscriptions are blocked entirely
const ALLOWED_QUERY_FIELDS = new Set([
  "accounts",
  "accountMappings",
  "books",
  "budgets",
  "journalEntries",
  "reconciliationQueues",
  "savingsGoals",
]);

// `books` is scoped by organizationId; the rest are scoped by bookId
const ORG_SCOPED_FIELDS = new Set(["books"]);

type ScopeRequirements =
  | { error: string }
  | { bookIds: string[]; organizationIds: string[] };

/**
 * Pull the scoping id (a UUID string) out of a field's `condition` argument,
 * resolving a `$variable` against the operation's variable values so an inline
 * literal and a variable are both covered
 */
const extractConditionId = (
  field: FieldNode,
  key: "bookId" | "organizationId",
  variableValues: Record<string, unknown>,
): string | undefined => {
  const conditionArg = field.arguments?.find(
    (a) => a.name.value === "condition",
  );
  if (!conditionArg || conditionArg.value.kind !== "ObjectValue") {
    return undefined;
  }
  const idField = conditionArg.value.fields.find((f) => f.name.value === key);
  if (!idField) return undefined;

  const value = idField.value;
  if (value.kind === "StringValue") return value.value;
  if (value.kind === "Variable") {
    const resolved = variableValues[value.name.value];
    return typeof resolved === "string" ? resolved : undefined;
  }
  return undefined;
};

/**
 * Inspect a GraphQL operation and return the book/organization ids it must be
 * authorized against, or an error string when it is not allowed at all (a
 * non-query operation, an un-allowlisted root field, or a scoped field with no
 * book/org id). The caller then verifies access to the returned ids.
 *
 * This is the request-layer tenant guard: the Postgraphile schema is generated
 * from the tables with no per-book filtering, so without this any authenticated
 * user could read any workspace's rows
 * @param document - Parsed GraphQL document
 * @param operationName - Selected operation name, if the doc has several
 * @param variableValues - The request's variable values
 */
export const extractScopeRequirements = (
  document: DocumentNode,
  operationName: string | null | undefined,
  variableValues: Record<string, unknown>,
): ScopeRequirements => {
  const operations = document.definitions.filter(
    (d): d is OperationDefinitionNode => d.kind === "OperationDefinition",
  );
  const operation = operationName
    ? operations.find((o) => o.name?.value === operationName)
    : operations[0];

  if (!operation) return { error: "No operation to execute" };
  if (operation.operation !== "query") {
    return { error: "Only read queries are permitted over GraphQL" };
  }

  const bookIds: string[] = [];
  const organizationIds: string[] = [];

  for (const selection of operation.selectionSet.selections) {
    if (selection.kind !== "Field") {
      return { error: "Fragments are not permitted at the query root" };
    }
    const name = selection.name.value;

    // Introspection is handled (and, in production, disabled) elsewhere
    if (name.startsWith("__")) continue;

    if (!ALLOWED_QUERY_FIELDS.has(name)) {
      return { error: `Field "${name}" is not permitted` };
    }

    if (ORG_SCOPED_FIELDS.has(name)) {
      const orgId = extractConditionId(
        selection,
        "organizationId",
        variableValues,
      );
      if (!orgId)
        return { error: `"${name}" must be scoped to an organization` };
      organizationIds.push(orgId);
    } else {
      const bookId = extractConditionId(selection, "bookId", variableValues);
      if (!bookId) return { error: `"${name}" must be scoped to a book` };
      bookIds.push(bookId);
    }
  }

  return { bookIds, organizationIds };
};
