package inventory

import (
	"testing"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/tracker"
)

func TestSnapshotsEqual(t *testing.T) {
	a := map[string]tracker.InstalledAppInfo{
		"Discord": {Name: "Discord", Version: "1.0"},
	}
	b := map[string]tracker.InstalledAppInfo{
		"Discord": {Name: "Discord", Version: "1.0"},
	}
	if !snapshotsEqual(a, b) {
		t.Fatal("expected identical snapshots to be equal")
	}
}

func TestSnapshotsEqual_DifferentVersion(t *testing.T) {
	a := map[string]tracker.InstalledAppInfo{"Discord": {Name: "Discord", Version: "1.0"}}
	b := map[string]tracker.InstalledAppInfo{"Discord": {Name: "Discord", Version: "2.0"}}
	if snapshotsEqual(a, b) {
		t.Fatal("expected a version change to be detected")
	}
}

func TestSnapshotsEqual_AddedApp(t *testing.T) {
	a := map[string]tracker.InstalledAppInfo{"Discord": {Name: "Discord"}}
	b := map[string]tracker.InstalledAppInfo{
		"Discord": {Name: "Discord"},
		"Chrome":  {Name: "Chrome"},
	}
	if snapshotsEqual(a, b) {
		t.Fatal("expected a new app to be detected")
	}
}

func TestSnapshotsEqual_RemovedApp(t *testing.T) {
	a := map[string]tracker.InstalledAppInfo{
		"Discord": {Name: "Discord"},
		"Chrome":  {Name: "Chrome"},
	}
	b := map[string]tracker.InstalledAppInfo{"Discord": {Name: "Discord"}}
	if snapshotsEqual(a, b) {
		t.Fatal("expected a removed app to be detected")
	}
}
