---
"@omnidotdev/myfi-api": minor
---

Deleting a workspace now deletes its MyFi books with everything in them. Before the books go, their bank connections are removed at Plaid, payroll connections are revoked at Gusto, and attached files and documents are deleted from storage. Deleting a book, or purging your books from a workspace, now releases those connections and files too, instead of leaving them behind
