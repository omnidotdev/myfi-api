# @omnidotdev/myfi-api

## 0.1.0

### Minor Changes

- [#22](https://github.com/omnidotdev/myfi-api/pull/22) [`4caa5d2`](https://github.com/omnidotdev/myfi-api/commit/4caa5d2f9d3ec7cbba240ef36dc38dfa5f317465) Thanks [@coopbri](https://github.com/coopbri)! - AI categorization suggestions now tell you when a workspace needs Omni credits or a Pro plan to use AI, instead of reporting that its AI allowance is used up. Background categorization keeps using your rules in the meantime.

- [#23](https://github.com/omnidotdev/myfi-api/pull/23) [`27bd3ae`](https://github.com/omnidotdev/myfi-api/commit/27bd3aebd389d9a1f10c59791eb6a37d700df67c) Thanks [@coopbri](https://github.com/coopbri)! - Deleting a workspace now deletes its MyFi books with everything in them. Before the books go, their bank connections are removed at Plaid, payroll connections are revoked at Gusto, and attached files and documents are deleted from storage. Deleting a book, or purging your books from a workspace, now releases those connections and files too, instead of leaving them behind

### Patch Changes

- [#29](https://github.com/omnidotdev/myfi-api/pull/29) [`a7cf5a6`](https://github.com/omnidotdev/myfi-api/commit/a7cf5a612a8ae6d61cbc062891b4b0102480d5fd) Thanks [@coopbri](https://github.com/coopbri)! - The production build now runs in production mode, so API errors no longer include internal details and GraphQL runs without development overhead

- [`e5f274a`](https://github.com/omnidotdev/myfi-api/commit/e5f274acdc2ea7399c888a51ddbea20fff620b1e) Thanks [@coopbri](https://github.com/coopbri)! - Return a generic "not available yet" message when payroll connection is not provisioned, instead of naming internal configuration.

- [#21](https://github.com/omnidotdev/myfi-api/pull/21) [`ca08969`](https://github.com/omnidotdev/myfi-api/commit/ca08969d0ab02ae6d241651010029c64428b5106) Thanks [@coopbri](https://github.com/coopbri)! - Remove the unused generated create, update, and delete mutations from the GraphQL schema

  GraphQL is read-only (writes go through the REST API); the schema no longer lists mutations that were already refused.

- [#24](https://github.com/omnidotdev/myfi-api/pull/24) [`fabb218`](https://github.com/omnidotdev/myfi-api/commit/fabb218bfd9b5954c3f3b18e2fbebbb3696ed621) Thanks [@coopbri](https://github.com/coopbri)! - Fix the workspace deletion webhook answering 500 in production: the book access middleware reads every request body first, so the webhook now captures its raw body through its own parse hook

- [#26](https://github.com/omnidotdev/myfi-api/pull/26) [`ead8000`](https://github.com/omnidotdev/myfi-api/commit/ead8000e46fe560872ce94a064669e80a9161282) Thanks [@coopbri](https://github.com/coopbri)! - Fix the Mantle webhook rejecting every delivery from Vortex: it answered 500 because the request body was read after the book access middleware had consumed it, and it rejected invoice and payment events whose optional fields are null or whose amounts are decimal strings. Mantle invoices, payments, and credits now book into the workspace's ledger

- [#25](https://github.com/omnidotdev/myfi-api/pull/25) [`0feaf83`](https://github.com/omnidotdev/myfi-api/commit/0feaf83462874b094e688ce7b9706116c1fba234) Thanks [@coopbri](https://github.com/coopbri)! - Stop writing users' email addresses to the logs: email sends log only the recipient count and message id, by moving to `@omnidotdev/providers` v0.2.0.
