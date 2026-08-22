# Database files were committed to a public repo

`database.db`, `database.db-shm`, `database.db-wal`, and `dev.db` were tracked in git and present
on `main` in this **public** repository. They contain real data — as of the commit that stopped
tracking them, 10 rows in `users` (Discord IDs/usernames) and 4 rows in `tickets` (which can
include a support transcript). Two commits touch `database.db`: `c3298b6` ("Gate Keeper") and
`0835364` ("Tickets and Operator").

## What this PR does

Stops future commits from including these files (`git rm --cached` + `.gitignore`). **It does
not remove them from history** — anyone who already cloned the repo, or who fetches before a
history rewrite, still has them, and they remain visible in old commits on GitHub until scrubbed.

## What still needs to happen (not done here — destructive/public-facing, needs a deliberate call)

1. Decide whether to temporarily flip the repo private while the history rewrite is in progress.
2. Rewrite history to remove the files entirely, e.g.:
   ```
   git filter-repo --path database.db --path database.db-shm --path database.db-wal --path dev.db --invert-paths
   ```
   (or the BFG Repo-Cleaner equivalent) — then force-push every branch and have any other clones
   re-clone rather than pull.
3. Notify anyone who might have forked/cloned the repo, since the data was publicly exposed for
   as long as it was on `main`.
4. Going forward: the bot's actual runtime database lives wherever `core/database.ts` resolves it
   (`./data/database.db`, now gitignored) — nothing else needs to change for new deployments.
