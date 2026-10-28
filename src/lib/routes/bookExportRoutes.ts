import { Elysia, t } from "elysia";

import {
  bookExportFilename,
  buildBookExport,
} from "lib/export/buildBookExport";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";

// Full book-data export: streams every book-scoped table as one JSON document
// for backup, portability, and account offboarding
const bookExportRoutes = new Elysia({ prefix: "/api/books" }).get(
  "/:id/export",
  async ({ params, request, set }) => {
    const { id } = params;

    // Addressed by book id with no `bookId` in query/body, so the global
    // book-access middleware does not guard it. Exporting the entire book
    // exposes all of its data, so require owner-level access, matching the
    // other id-addressed book mutations
    const auth = await authorizeBook(request, id, "owner", set);
    if (!auth) return { error: "Forbidden" };

    const exportDoc = await buildBookExport(id);

    if (!exportDoc) {
      set.status = 404;
      return { error: "Book not found" };
    }

    const filename = bookExportFilename(
      exportDoc.book.name,
      exportDoc.exportedAt,
    );

    return new Response(JSON.stringify(exportDoc, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
  {
    params: t.Object({ id: t.String() }),
  },
);

export default bookExportRoutes;
