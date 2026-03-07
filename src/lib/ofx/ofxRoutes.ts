import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { connectedAccountTable } from "lib/db/schema";
import { decryptToken, encryptToken } from "lib/encryption/tokenEncryption";
import { importTransactions } from "lib/import";
import { fetchOfxTransactions } from "./ofxClient";

import type { OfxConnectionConfig } from "./ofxClient";

const ofxRoutes = new Elysia({ prefix: "/api/ofx" })
	.post(
		"/connect",
		async ({ body, set }) => {
			const {
				bookId,
				ofxUrl,
				org,
				fid,
				username,
				password,
				accountNumber,
				routingNumber,
				accountType,
				institutionName,
			} = body;

			// Test connection by fetching last 7 days
			const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];

			const encryptedPassword = encryptToken(password);

			const config: OfxConnectionConfig = {
				ofxUrl,
				org,
				fid,
				username,
				encryptedPassword,
				accountNumber,
				routingNumber,
				accountType,
			};

			try {
				await fetchOfxTransactions(config, sevenDaysAgo);
			} catch (err) {
				set.status = 400;
				return {
					error: `Connection test failed: ${err instanceof Error ? err.message : "Unknown error"}`,
				};
			}

			// Store full config (including encrypted password) as accessToken
			const fullConfigJson = JSON.stringify(config);

			const [connected] = await dbPool
				.insert(connectedAccountTable)
				.values({
					bookId,
					provider: "ofx_direct",
					providerAccountId: `${fid}:${accountNumber}`,
					institutionName: institutionName ?? null,
					mask: accountNumber.slice(-4),
					accessToken: encryptToken(fullConfigJson),
					status: "active",
				})
				.returning();

			set.status = 201;

			return { connectedAccountId: connected.id };
		},
		{
			body: t.Object({
				bookId: t.String(),
				ofxUrl: t.String(),
				org: t.String(),
				fid: t.String(),
				username: t.String(),
				password: t.String(),
				accountNumber: t.String(),
				routingNumber: t.String(),
				accountType: t.String(),
				institutionName: t.Optional(t.String()),
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

			if (!account || account.provider !== "ofx_direct") {
				set.status = 404;
				return { error: "OFX connected account not found" };
			}

			if (!account.accessToken) {
				set.status = 400;
				return { error: "Account has no connection config" };
			}

			const config: OfxConnectionConfig = JSON.parse(
				decryptToken(account.accessToken),
			);

			// Fetch last 90 days (OFX doesn't have cursor-based sync)
			const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];

			const transactions = await fetchOfxTransactions(config, ninetyDaysAgo);

			const result = await importTransactions({
				bookId: account.bookId,
				source: "ofx_import",
				transactions,
			});

			// Update last synced timestamp
			await dbPool
				.update(connectedAccountTable)
				.set({ lastSyncedAt: new Date().toISOString() })
				.where(eq(connectedAccountTable.id, account.id));

			return result;
		},
		{
			body: t.Object({
				connectedAccountId: t.String(),
			}),
		},
	);

export default ofxRoutes;
