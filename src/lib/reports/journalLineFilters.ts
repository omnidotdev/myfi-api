import { inArray } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  journalLineProjectTable,
  journalLineTable,
  journalLineTagTable,
  journalLineTrackingCategoryTable,
} from "lib/db/schema";

/**
 * Restrict a report's journal lines to those carrying ANY of the given tag ids,
 * expressed as a subquery membership test rather than a join.
 *
 * Joining the many-to-many `journal_line_tag` table and then SUMming fans a
 * line out into one row per matching tag, so a line tagged with two of the
 * filtered tags is counted twice and the report's totals inflate. A
 * `WHERE journal_line.id IN (select ...)` filter counts each line exactly once.
 */
export const lineHasAnyTag = (tagIds: string[]) =>
  inArray(
    journalLineTable.id,
    dbPool
      .select({ id: journalLineTagTable.journalLineId })
      .from(journalLineTagTable)
      .where(inArray(journalLineTagTable.tagId, tagIds)),
  );

/** Same membership-test approach for project filtering (also many-to-many) */
export const lineHasAnyProject = (projectIds: string[]) =>
  inArray(
    journalLineTable.id,
    dbPool
      .select({ id: journalLineProjectTable.journalLineId })
      .from(journalLineProjectTable)
      .where(inArray(journalLineProjectTable.projectId, projectIds)),
  );

/** Same membership-test approach for tracking-category (class/location) filtering */
export const lineHasAnyTrackingCategory = (categoryIds: string[]) =>
  inArray(
    journalLineTable.id,
    dbPool
      .select({ id: journalLineTrackingCategoryTable.journalLineId })
      .from(journalLineTrackingCategoryTable)
      .where(
        inArray(
          journalLineTrackingCategoryTable.trackingCategoryId,
          categoryIds,
        ),
      ),
  );
