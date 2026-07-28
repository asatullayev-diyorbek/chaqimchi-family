# Known Issues

## Agent uploader: crash-mid-flight can duplicate a batch

**Where:** `agent/internal/sync/uploader.go` (`Uploader.pendingBatchID` / `pendingEvents`)

**What:** The retry-with-same-`batch_id` logic that makes network-level upload failures safe to retry lives only in the `Uploader` struct's in-memory fields. If the agent process crashes or is killed between the server successfully writing a batch and the agent marking those events `Synced=true` locally, the pending `batch_id` is lost. On restart, the uploader will fetch the same still-unsynced events from the SQLite buffer and mint a **new** `batch_id` for them — the server's idempotency check keys on `batch_id`, so it can't recognize this as a resend, and the events get stored a second time under a new `EventBatch`.

**When it matters:** Only in the narrow window between "server ack received" and "local buffer marked synced" — a normal network retry (the case Bosqich 1 targeted) is unaffected, since the same `batch_id` is correctly reused as long as the process stays alive.

**Proposed fix:** Persist `pendingBatchID` (and the event IDs it covers) in the SQLite buffer itself, not just in memory, so it survives a process restart. Deferred to the Bosqich 5/6 hardening pass — not fixed now to avoid scope creep on Bosqich 1.
