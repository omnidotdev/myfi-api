#!/usr/bin/env bun

/**
 * Backfill Book Access
 *
 * Ensures every book has at least one owner in the book_access table.
 * For books without any access records, creates an owner record for
 * the specified user ID (or a default system user).
 *
 * Usage:
 *   bun run src/scripts/backfillBookAccess.ts [--user-id <userId>]
 *
 * If --user-id is not provided, the script will list books without
 * access records and exit without making changes.
 */

import { notInArray } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { bookAccessTable, bookTable } from "lib/db/schema";

const args = process.argv.slice(2);
const userIdIndex = args.indexOf("--user-id");
const userId = userIdIndex >= 0 ? args[userIdIndex + 1] : undefined;

// Find books that have no access records
const booksWithAccess = dbPool
  .select({ bookId: bookAccessTable.bookId })
  .from(bookAccessTable);

const orphanedBooks = await dbPool
  .select({ id: bookTable.id, name: bookTable.name })
  .from(bookTable)
  .where(notInArray(bookTable.id, booksWithAccess));

if (orphanedBooks.length === 0) {
  console.info("All books have at least one access record. Nothing to do.");
  process.exit(0);
}

console.info(`Found ${orphanedBooks.length} book(s) without access records:`);
for (const book of orphanedBooks) {
  console.info(`  - ${book.name} (${book.id})`);
}

if (!userId) {
  console.info(
    "\nRun with --user-id <userId> to grant owner access to these books.",
  );
  console.info(
    "Example: bun run src/scripts/backfillBookAccess.ts --user-id auth0|abc123",
  );
  process.exit(0);
}

console.info(`\nGranting owner access to user: ${userId}`);

let created = 0;

for (const book of orphanedBooks) {
  await dbPool
    .insert(bookAccessTable)
    .values({
      bookId: book.id,
      userId,
      role: "owner",
    })
    .onConflictDoNothing();

  console.info(`  Created owner access for "${book.name}"`);
  created++;
}

console.info(`\nDone. Created ${created} access record(s).`);
