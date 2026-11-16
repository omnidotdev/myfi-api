---
"@omnidotdev/myfi-api": patch
---

Remove the unused generated create, update, and delete mutations from the GraphQL schema

GraphQL is read-only (writes go through the REST API); the schema no longer lists mutations that were already refused.
