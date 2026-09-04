//go:build windows

package tracker

import (
	"database/sql"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
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

// userAppData is one Windows account's AppData roots. The agent runs as the
// SYSTEM service in session 0, where os.Getenv("LOCALAPPDATA") points at
// C:\Windows\System32\config\systemprofile — never the child's profile — so
// browser history has to be gathered by walking C:\Users directly (SYSTEM can
// read each user's files). Same class of problem as the foreground-window
// tracker, which is why that one runs through a session helper.
type userAppData struct {
	user    string // account name, becomes the checkpoint key prefix
	local   string // <profile>\AppData\Local
	roaming string // <profile>\AppData\Roaming
}

// nonUserProfiles are the C:\Users entries that never belong to a person.
var nonUserProfiles = map[string]bool{
	"public": true, "default": true, "default user": true, "all users": true,
	"defaultuser0": true, "wdagutilityaccount": true,
}

// userProfileRoots enumerates the real user profiles under the Users
// directory. Falls back to the current process's own AppData (covers a dev
// run of the agent as a normal user, where os.Getenv is correct).
func userProfileRoots() []userAppData {
	usersDir := `C:\Users`
	if pub := os.Getenv("PUBLIC"); pub != "" {
		usersDir = filepath.Dir(pub) // C:\Users\Public -> C:\Users
	}
	var out []userAppData
	if entries, err := os.ReadDir(usersDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() || nonUserProfiles[strings.ToLower(e.Name())] {
				continue
			}
			base := filepath.Join(usersDir, e.Name())
			local := filepath.Join(base, `AppData\Local`)
			if _, statErr := os.Stat(local); statErr != nil {
				continue
			}
			out = append(out, userAppData{
				user:    e.Name(),
				local:   local,
				roaming: filepath.Join(base, `AppData\Roaming`),
			})
		}
	}
	if len(out) == 0 {
		// Dev / interactive run: no access to C:\Users, but our own env is right.
		if l := os.Getenv("LOCALAPPDATA"); l != "" {
			out = append(out, userAppData{user: os.Getenv("USERNAME"), local: l, roaming: os.Getenv("APPDATA")})
		}
	}
	return out
}

func chromiumSources(u userAppData) []browserSource {
	return []browserSource{
		{name: "chrome", root: filepath.Join(u.local, `Google\Chrome\User Data`), fileName: "History"},
		{name: "edge", root: filepath.Join(u.local, `Microsoft\Edge\User Data`), fileName: "History"},
		{name: "brave", root: filepath.Join(u.local, `BraveSoftware\Brave-Browser\User Data`), fileName: "History"},
		{name: "opera", root: filepath.Join(u.roaming, `Opera Software\Opera Stable`), fileName: "History"},
		{name: "vivaldi", root: filepath.Join(u.local, `Vivaldi\User Data`), fileName: "History"},
		{name: "firefox", root: filepath.Join(u.roaming, `Mozilla\Firefox\Profiles`), firefox: true, fileName: "places.sqlite"},
	}
}

var browserHistoryDiscoveryLogged sync.Once

// collectBrowserVisits reads every user profile's installed browsers and
// returns the visits newer than each profile's checkpoint. Errors on
// individual profiles are surfaced via the returned error but never stop the
// others.
func collectBrowserVisits(ckpts checkpoints) ([]browserVisit, error) {
	var all []browserVisit
	var firstErr error
	users := userProfileRoots()
	dbsFound := 0

	for _, u := range users {
		for _, src := range chromiumSources(u) {
			for _, p := range profileDirs(src) {
				dbPath := filepath.Join(p.dir, src.fileName)
				if _, err := os.Stat(dbPath); err != nil {
					continue
				}
				dbsFound++
				key := u.user + "/" + src.name + "/" + p.label
				visits, err := readProfile(src, u.user, dbPath, p.label, ckpts.since(key))
				if err != nil && firstErr == nil {
					firstErr = fmt.Errorf("%s: %w", key, err)
				}
				all = append(all, visits...)
			}
		}
	}

	browserHistoryDiscoveryLogged.Do(func() {
		log.Printf("browser history: %d user profile(s), %d history DB(s) found", len(users), dbsFound)
	})
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
func readProfile(src browserSource, user, dbPath, label string, since time.Time) ([]browserVisit, error) {
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
		return queryFirefox(db, user, src.name, label, since)
	}
	return queryChromium(db, user, src.name, label, since)
}

func queryChromium(db *sql.DB, user, browser, profile string, since time.Time) ([]browserVisit, error) {
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
			User:      user,
			Browser:   browser,
			Profile:   profile,
			URL:       u,
			VisitedAt: time.Unix(secs, nsec).UTC(),
			Duration:  time.Duration(dur) * time.Microsecond,
		})
	}
	return out, rows.Err()
}

func queryFirefox(db *sql.DB, user, browser, profile string, since time.Time) ([]browserVisit, error) {
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
			User:      user,
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
