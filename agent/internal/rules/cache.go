// Package rules fetches the device's rules from the backend, caches them
// locally so they still apply when offline (offline-first, per the
// architecture doc), and enforces them against tracked app usage.
package rules

import (
	"database/sql"
	"encoding/json"
	"time"

	_ "modernc.org/sqlite"
)

type Rule struct {
	ID       string
	RuleType string
	Value    json.RawMessage
}

type Cache struct {
	db *sql.DB
}

// OpenCache opens (or creates) the rules cache table at path. Safe to point
// at the same SQLite file the event buffer uses — this is just one more
// table in it.
func OpenCache(path string) (*Cache, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}

	const schema = `
	CREATE TABLE IF NOT EXISTS cached_rules (
		id         TEXT PRIMARY KEY,
		rule_type  TEXT NOT NULL,
		value      TEXT NOT NULL,
		fetched_at TEXT NOT NULL
	);
	`
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}

	return &Cache{db: db}, nil
}

func (c *Cache) Close() error {
	return c.db.Close()
}

// Replace atomically swaps the cached rule set for a freshly fetched one.
// On fetch failure the caller simply doesn't call Replace, so All()
// continues to serve the last known-good set — that's the offline-first
// guarantee.
func (c *Cache) Replace(rules []Rule) error {
	tx, err := c.db.Begin()
	if err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM cached_rules`); err != nil {
		tx.Rollback()
		return err
	}
	stmt, err := tx.Prepare(
		`INSERT INTO cached_rules (id, rule_type, value, fetched_at) VALUES (?, ?, ?, ?)`,
	)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()

	now := time.Now().UTC().Format(time.RFC3339)
	for _, r := range rules {
		if _, err := stmt.Exec(r.ID, r.RuleType, string(r.Value), now); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

// All returns the currently cached rule set — whatever was last
// successfully fetched, regardless of current connectivity.
func (c *Cache) All() ([]Rule, error) {
	rows, err := c.db.Query(`SELECT id, rule_type, value FROM cached_rules`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Rule
	for rows.Next() {
		var r Rule
		var value string
		if err := rows.Scan(&r.ID, &r.RuleType, &value); err != nil {
			return nil, err
		}
		r.Value = json.RawMessage(value)
		out = append(out, r)
	}
	return out, rows.Err()
}
