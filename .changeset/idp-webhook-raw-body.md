---
"@omnidotdev/myfi-api": patch
---

Fix the workspace deletion webhook answering 500 in production: the book access middleware reads every request body first, so the webhook now captures its raw body through its own parse hook
