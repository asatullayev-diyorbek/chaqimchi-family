//go:build windows

package tracker

import (
	"database/sql"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

// chromeEpochOffset is the gap between the Windows FILETIME epoch
// (1601-01-01) that Chromium stores visit times against and the Unix epoch,
// in seconds.
const chromeEpochOffset = 11644473600

// perProfileLimit caps how many visits one profile can contribute per poll,
// so a huge history (or a long agent outage) can't flood one batch.
const perProfileLimit = 800

type browserSource struct {
	name     string // checkpoint key prefix
	root     string // ...\User Data  (Chromium) or Firefox "Profiles" dir
	firefox  bool
	fileName string // "History" or "places.sqlite"
}

func chromiumSources() []browserSource {
	local := os.Getenv("LOCALAPPDATA")
	roaming := os.Getenv("APPDATA")
	var s []browserSource
	if local != "" {
		s = append(s,
			browserSource{name: "chrome", root: filepath.Join(local, `Google\Chrome\User Data`), fileName: "History"},
			browserSource{name: "edge", root: filepath.Join(local, `Microsoft\Edge\User Data`), fileName: "History"},
			browserSource{name: "brave", root: filepath.Join(local, `BraveSoftware\Brave-Browser\User Data`), fileName: "History"},
			browserSource{name: "opera", root: filepath.Join(roaming, `Opera Software\Opera Stable`), fileName: "History"},
			browserSource{name: "vivaldi", root: filepath.Join(local, `Vivaldi\User Data`), fileName: "History"},
		)
	}
	if roaming != "" {
		s = append(s, browserSource{name: "firefox", root: filepath.Join(roaming, `Mozilla\Firefox\Profiles`), firefox: true, fileName: "places.sqlite"})
	}
	return s
}

// collectBrowserVisits reads every installed browser profile and returns the
// visits newer than its checkpoint. Errors on individual profiles are logged
// by the caller via the returned error but never stop the others.
func collectBrowserVisits(ckpts checkpoints) ([]browserVisit, error) {
	var all []browserVisit
	var firstErr error

	for _, src := range chromiumSources() {
		profiles := profileDirs(src)
		for _, p := range profiles {
			key := src.name + "/" + p.label
			dbPath := filepath.Join(p.dir, src.fileName)
			if _, err := os.Stat(dbPath); err != nil {
				continue
			}
			visits, err := readProfile(src, key, dbPath, p.label, ckpts.since(key))
			if err != nil && firstErr == nil {
				firstErr = fmt.Errorf("%s: %w", key, err)
			}
			all = append(all, visits...)
		}
	}
	return all, firstErr
}

type profileDir struct {
	dir   string
	label string
}

func profileDirs(src browserSource) []profileDir {
	entries, err := os.ReadDir(src.root)
	if err != nil {
		return nil
	}
	var out []profileDir
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		if src.firefox {
			// Firefox profile dirs look like "xxxxxxxx.default-release".
			out = append(out, profileDir{dir: filepath.Join(src.root, name), label: name})
			continue
		}
		if name == "Default" || strings.HasPrefix(name, "Profile ") {
			out = append(out, profileDir{dir: filepath.Join(src.root, name), label: name})
		}
	}
	return out
}

// readProfile snapshots a (possibly locked) history DB to a temp file and
// returns visits after `since`.
func readProfile(src browserSource, key, dbPath, label string, since time.Time) ([]browserVisit, error) {
	tmp, cleanup, err := snapshotDB(dbPath)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	db, err := sql.Open("sqlite", "file:"+tmp+"?mode=ro")
	if err != nil {
		return nil, err
	}
	defer db.Close()

	if src.firefox {
		return queryFirefox(db, src.name, label, since)
	}
	return queryChromium(db, src.name, label, since)
}

func queryChromium(db *sql.DB, browser, profile string, since time.Time) ([]browserVisit, error) {
	sinceChrome := (since.Unix() + chromeEpochOffset) * 1_000_000
	rows, err := db.Query(
		`SELECT urls.url, visits.visit_time, visits.visit_duration
		 FROM visits JOIN urls ON urls.id = visits.url
		 WHERE visits.visit_time > ?
		 ORDER BY visits.visit_time ASC
		 LIMIT ?`, sinceChrome, perProfileLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []browserVisit
	for rows.Next() {
		var u string
		var vt, dur int64
		if err := rows.Scan(&u, &vt, &dur); err != nil {
			continue
		}
		secs := vt/1_000_000 - chromeEpochOffset
		nsec := (vt % 1_000_000) * 1000
		out = append(out, browserVisit{
			Browser:   browser,
			Profile:   profile,
			URL:       u,
			VisitedAt: time.Unix(secs, nsec).UTC(),
			Duration:  time.Duration(dur) * time.Microsecond,
		})
	}
	return out, rows.Err()
}

func queryFirefox(db *sql.DB, browser, profile string, since time.Time) ([]browserVisit, error) {
	rows, err := db.Query(
		`SELECT p.url, h.visit_date
		 FROM moz_historyvisits h JOIN moz_places p ON p.id = h.place_id
		 WHERE h.visit_date > ?
		 ORDER BY h.visit_date ASC
		 LIMIT ?`, since.UnixMicro(), perProfileLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []browserVisit
	for rows.Next() {
		var u string
		var micros int64
		if err := rows.Scan(&u, &micros); err != nil {
			continue
		}
		out = append(out, browserVisit{
			Browser:   browser,
			Profile:   profile,
			URL:       u,
			VisitedAt: time.UnixMicro(micros).UTC(),
		})
	}
	return out, rows.Err()
}

// snapshotDB copies the history DB (plus any -wal / -shm sidecars) into a
// temp directory so it can be read while the browser holds the original
// open. The returned cleanup removes the whole temp dir.
func snapshotDB(dbPath string) (string, func(), error) {
	dir, err := os.MkdirTemp("", "chaqimchi-bh-")
	if err != nil {
		return "", func() {}, err
	}
	cleanup := func() { _ = os.RemoveAll(dir) }

	base := filepath.Base(dbPath)
	for _, suffix := range []string{"", "-wal", "-shm"} {
		src := dbPath + suffix
		if err := copyFile(src, filepath.Join(dir, base+suffix)); err != nil {
			if suffix == "" {
				cleanup()
				return "", func() {}, err
			}
			// sidecars are optional
		}
	}
	return filepath.Join(dir, base), cleanup, nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}
