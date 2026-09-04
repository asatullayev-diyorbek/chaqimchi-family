//go:build windows

package tracker

import (
	"os"
	"path/filepath"
	"testing"
)

func TestUserProfileRoots_FindsRealProfiles(t *testing.T) {
	roots := userProfileRoots()
	if len(roots) == 0 {
		t.Skip("no user profiles enumerable in this environment")
	}
	for _, r := range roots {
		if r.user == "" || r.local == "" {
			t.Errorf("incomplete profile root: %+v", r)
		}
		if _, err := os.Stat(r.local); err != nil {
			t.Errorf("reported AppData\\Local does not exist: %s", r.local)
		}
		// The bug this replaced pointed every account at the SYSTEM profile.
		if filepath.Base(filepath.Dir(filepath.Dir(r.local))) == "systemprofile" {
			t.Errorf("still resolving to the SYSTEM profile: %s", r.local)
		}
	}
}

func TestChromiumSources_BuildFromProfileRoot(t *testing.T) {
	u := userAppData{user: "Test", local: `C:\Users\Test\AppData\Local`, roaming: `C:\Users\Test\AppData\Roaming`}
	srcs := chromiumSources(u)
	var names []string
	for _, s := range srcs {
		names = append(names, s.name)
		if s.root == "" {
			t.Errorf("%s source has no root", s.name)
		}
	}
	// Chrome/Edge/Brave/Opera/Vivaldi/Firefox.
	if len(srcs) != 6 {
		t.Fatalf("expected 6 browser sources, got %d (%v)", len(srcs), names)
	}
	if srcs[0].name != "chrome" || srcs[0].root != `C:\Users\Test\AppData\Local\Google\Chrome\User Data` {
		t.Errorf("chrome source wrong: %+v", srcs[0])
	}
}
