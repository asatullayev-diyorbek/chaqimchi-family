# Known Issues

## Resolved: agent uploader crash-mid-flight batch duplication

**Where:** `agent/internal/sync/uploader.go` (`Uploader.pendingBatchID` / `pendingEvents`)

**Fix:** `agent/internal/buffer` now persists a pending batch ID and its event IDs in SQLite before a request is sent. Server acknowledgement marks events synced and removes that reservation in one transaction. If the agent stops in between, the next process reloads and resends the identical batch ID, which the server treats as idempotent.

**Verification:** `TestSyncOnce_ReusesPersistedBatchAfterRestart` covers the restart path; normal retry behavior remains covered by `TestSyncOnce_RetriesWithSameBatchIDAfterFailure`.
