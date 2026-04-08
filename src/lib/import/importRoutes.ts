import { Elysia, t } from "elysia";

import { importTransactions } from "./importTransactions";
import parseCsv from "./parseCsv";
import parseOfx from "./parseOfx";
import { previewCsv, previewOfx } from "./previewImport";

import type { InsertJournalEntry } from "lib/db/schema";
import type { ParsedTransaction } from "./importTransactions";

/**
 * Detect file format from filename
 */
const detectFormat = (
  filename: string,
  _content: string,
): "csv" | "ofx" | null => {
  const ext = filename.toLowerCase().split(".").pop();

  if (ext === "csv") return "csv";
  if (ext === "ofx" || ext === "qfx") return "ofx";

  return null;
};

const importRoutes = new Elysia({ prefix: "/api/import" })
  .post(
    "/file",
    async ({ body, set }) => {
      const { bookId, file, columnMap: rawColumnMap } = body;

      const content = await file.text();
      const format = detectFormat(file.name, content);

      if (!format) {
        set.status = 400;
        return {
          error: "Unsupported file format. Accepted: .csv, .ofx, .qfx",
        };
      }

      let transactions: ParsedTransaction[];
      let source: InsertJournalEntry["source"];

      try {
        if (format === "csv") {
          const customMap = rawColumnMap ? JSON.parse(rawColumnMap) : undefined;
          transactions = parseCsv(content, customMap);
          source = "csv_import";
        } else {
          transactions = parseOfx(content);
          source = "ofx_import";
        }
      } catch (err) {
        set.status = 400;
        return {
          error: err instanceof Error ? err.message : "Failed to parse file",
        };
      }

      if (transactions.length === 0) {
        set.status = 400;
        return { error: "No transactions found in file" };
      }

      const result = await importTransactions({
        bookId,
        source,
        transactions,
      });

      return {
        ...result,
        totalParsed: transactions.length,
        format,
      };
    },
    {
      body: t.Object({
        bookId: t.String(),
        file: t.File(),
        columnMap: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/preview",
    async ({ body, set }) => {
      const { file, columnMap: rawColumnMap } = body;
      const content = await file.text();
      const format = detectFormat(file.name, content);

      if (!format) {
        set.status = 400;
        return {
          error: "Unsupported file format. Accepted: .csv, .ofx, .qfx",
        };
      }

      try {
        if (format === "csv") {
          const override = rawColumnMap ? JSON.parse(rawColumnMap) : undefined;
          return { format, ...previewCsv(content, override) };
        }
        return { format, ...previewOfx(content) };
      } catch (err) {
        set.status = 400;
        return {
          error: err instanceof Error ? err.message : "Failed to parse file",
        };
      }
    },
    {
      body: t.Object({
        file: t.File(),
        columnMap: t.Optional(t.String()),
      }),
    },
  );

export default importRoutes;
