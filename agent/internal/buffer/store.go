// Package buffer is the agent's local durability layer: trackers append
// events here immediately, independent of network state, and sync/uploader
// drains unsynced rows whenever connectivity allows. This is what makes the
// pipeline lossless across flaky/offline periods.
package buffer

import (
	"database/sql"
	"encoding/json"
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
