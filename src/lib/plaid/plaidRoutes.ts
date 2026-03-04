import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { CountryCode, Products } from "plaid";

import { dbPool } from "lib/db/db";
import { connectedAccountTable } from "lib/db/schema";
import { encryptToken } from "lib/encryption/tokenEncryption";
import plaidClient from "./plaidClient";
import syncTransactions from "./syncTransactions";

// Plaid REST routes for link token creation, token exchange, and sync
const plaidRoutes = new Elysia({ prefix: "/api/plaid" })
  .post(
    "/create-link-token",
    async ({ body }) => {
      const { userId, bookId } = body;

      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: "MyFi",
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: "en",
        metadata: { bookId },
      });

      return { linkToken: response.data.link_token };
    },
    {
      body: t.Object({
        userId: t.String(),
        bookId: t.String(),
      }),
    },
  )
  .post(
    "/exchange-token",
    async ({ body }) => {
      const { publicToken, bookId, institutionName, accountMask } = body;

      const response = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
      });

      const accessToken = encryptToken(response.data.access_token);
      const itemId = response.data.item_id;

      const [connected] = await dbPool
        .insert(connectedAccountTable)
        .values({
          bookId,
          provider: "plaid",
          providerAccountId: itemId,
          institutionName: institutionName ?? null,
          mask: accountMask ?? null,
          accessToken,
          status: "active",
        })
        .returning();

      return { connectedAccountId: connected.id };
    },
    {
      body: t.Object({
        publicToken: t.String(),
        bookId: t.String(),
        institutionName: t.Optional(t.String()),
        accountMask: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/sync",
    async ({ body, set }) => {
      const { connectedAccountId } = body;

      const [account] = await dbPool
        .select()
        .from(connectedAccountTable)
        .where(eq(connectedAccountTable.id, connectedAccountId));

      if (!account) {
        set.status = 404;
        return { error: "Connected account not found" };
      }

      const result = await syncTransactions(account);

      return result;
    },
    {
      body: t.Object({
        connectedAccountId: t.String(),
      }),
    },
  );

export default plaidRoutes;
