<!-- opal-source:start -->
## Committed = public, forever
Write every committed file as if a stranger will read it. opal's scanner catches known secrets and identifiers; these rules cover what it can't.
- Read secrets from environment variables. Never hardcode keys/tokens/passwords or commit `.env`, credentials, keys, or local DBs.
- Describe people generically ("a user"). Keep real names, emails, paths, and private details — the owner's OR anyone else's — out of code, docs, and PRDs.
- Strip owner narrative from docs/PRDs: no account counts, finances, health, location, employer, or strategy. The scanner can't see narrative — delete it on the diff yourself.
- Never bypass the guard (`--no-verify`). Blocked → fix it, or hand the push to the human.
<!-- opal-source:end -->
