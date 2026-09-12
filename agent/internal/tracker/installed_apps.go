package tracker

import (
	"regexp"
	"time"
)

// InstalledAppInfo is one row of the installed-apps inventory sent to the
// backend — a snapshot of what's currently installed, distinct from the
// foreground-usage-driven app tracking elsewhere in this package.
type InstalledAppInfo struct {
	Name        string
	Version     string
	Publisher   string
	InstallDate string // YYYY-MM-DD, or "" if unknown/unparseable
}

var noisePattern = regexp.MustCompile(
	`(?i)^(update for |security update|hotfix|kb\d{6,}|microsoft \.net |` +
		`\.net (desktop )?runtime|\.net framework|visual c\+\+ (\d{4} )?redistributable|` +
		`microsoft visual c\+\+|windows software development kit)`,
)

// parseInstallDate converts the registry's YYYYMMDD string to YYYY-MM-DD,
// or "" if it isn't in that shape.
func parseInstallDate(raw string) string {
	if len(raw) != 8 {
		return ""
	}
	t, err := time.Parse("20060102", raw)
	if err != nil {
		return ""
	}
	return t.Format("2006-01-02")
}
