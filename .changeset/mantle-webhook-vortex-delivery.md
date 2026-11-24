---
"@omnidotdev/myfi-api": patch
---

Fix the Mantle webhook rejecting every delivery from Vortex: it answered 500 because the request body was read after the book access middleware had consumed it, and it rejected invoice and payment events whose optional fields are null or whose amounts are decimal strings. Mantle invoices, payments, and credits now book into the workspace's ledger
