// Package buffer is the agent's local durability layer: trackers append
// events here immediately, independent of network state, and sync/uploader
// drains unsynced rows whenever connectivity allows. This is what makes the
// pipeline lossless across flaky/offline periods.
package buffer

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type Event struct {
	ID        string
	Type      string
	Payload   json.RawMessage
	CreatedAt time.Time
	Synced    bool
}

type Store struct {
	db *sql.DB
}

// Open creates/opens the buffer database at path (e.g.
// %ProgramData%\ChaqimchiFamily\buffer.db on Windows) and ensures the
// schema exists.
func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}

	const schema = `
	CREATE TABLE IF NOT EXISTS events (
		id         TEXT PRIMARY KEY,
		type       TEXT NOT NULL,
		payload    TEXT NOT NULL,
		created_at TEXT NOT NULL,
		synced     INTEGER NOT NULL DEFAULT 0
	);
	CREATE INDEX IF NOT EXISTS idx_events_synced ON events(synced);
	CREATE TABLE IF NOT EXISTS pending_batch (
		id        INTEGER PRIMARY KEY CHECK (id = 1),
		batch_id  TEXT NOT NULL,
		event_ids TEXT NOT NULL
	);
	`
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}

	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) Append(e Event) error {
	_, err := s.db.Exec(
		`INSERT INTO events (id, type, payload, created_at, synced) VALUES (?, ?, ?, ?, 0)`,
		e.ID, e.Type, string(e.Payload), e.CreatedAt.UTC().Format(time.RFC3339),
	)
	return err
}

// GetUnsynced returns up to limit events that haven't been synced yet,
// oldest first — the batch shape the uploader sends to the server.
func (s *Store) GetUnsynced(limit int) ([]Event, error) {
	rows, err := s.db.Query(
		`SELECT id, type, payload, created_at FROM events WHERE synced = 0 ORDER BY created_at ASC LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var e Event
		var payload, createdAt string
		if err := rows.Scan(&e.ID, &e.Type, &payload, &createdAt); err != nil {
			return nil, err
		}
		e.Payload = json.RawMessage(payload)
		e.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		events = append(events, e)
	}
	return events, rows.Err()
}

// MarkSynced flags the given event IDs as synced, called only after the
// server has acknowledged the batch they were sent in.
func (s *Store) MarkSynced(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare(`UPDATE events SET synced = 1 WHERE id = ?`)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, id := range ids {
		if _, err := stmt.Exec(id); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

// PendingBatch is the durable upload reservation. Persisting it before an
// HTTP request means a process restart retries the exact same batch_id,
// allowing the server's idempotency key to protect the acknowledgement gap.
type PendingBatch struct {
	BatchID  string
	EventIDs []string
}

func (s *Store) LoadPendingBatch() (*PendingBatch, error) {
	var batchID, rawIDs string
	err := s.db.QueryRow(`SELECT batch_id, event_ids FROM pending_batch WHERE id = 1`).Scan(&batchID, &rawIDs)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var ids []string
	if err := json.Unmarshal([]byte(rawIDs), &ids); err != nil {
		return nil, err
	}
	return &PendingBatch{BatchID: batchID, EventIDs: ids}, nil
}

func (s *Store) ReserveBatch(batchID string, eventIDs []string) error {
	rawIDs, err := json.Marshal(eventIDs)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(`INSERT INTO pending_batch (id, batch_id, event_ids) VALUES (1, ?, ?)`, batchID, string(rawIDs))
	return err
}

// EventsByID returns the reserved events in the original batch order.
func (s *Store) EventsByID(ids []string) ([]Event, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	events := make([]Event, 0, len(ids))
	for _, id := range ids {
		var e Event
		var payload, createdAt string
		err := s.db.QueryRow(`SELECT id, type, payload, created_at, synced FROM events WHERE id = ?`, id).Scan(&e.ID, &e.Type, &payload, &createdAt, &e.Synced)
		if err != nil {
			return nil, err
		}
		e.Payload = json.RawMessage(payload)
		e.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		events = append(events, e)
	}
	return events, nil
}

// CompleteBatch acknowledges both sides of an upload in one SQLite
// transaction. A crash leaves either the whole reservation intact (retry the
// same batch ID) or all events synced with no reservation; never an unsafe
// half-state.
func (s *Store) CompleteBatch(batchID string, ids []string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare(`UPDATE events SET synced = 1 WHERE id = ?`)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()
	for _, id := range ids {
		if _, err := stmt.Exec(id); err != nil {
			tx.Rollback()
			return err
		}
	}
	result, err := tx.Exec(`DELETE FROM pending_batch WHERE id = 1 AND batch_id = ?`, batchID)
	if err != nil {
		tx.Rollback()
		return err
	}
	if affected, _ := result.RowsAffected(); affected != 1 {
		tx.Rollback()
		return fmt.Errorf("pending batch %q was not found", batchID)
	}
	return tx.Commit()
}
