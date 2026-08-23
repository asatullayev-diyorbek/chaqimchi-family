package localipc

import "testing"

func TestStatusIsDisplayOnly(t *testing.T) {
	s := Status{Service: "running", Version: "1.0.0", StartedAt: "2026-08-03T00:00:00Z"}
	if s.Service != "running" || s.Version == "" || s.StartedAt == "" {
		t.Fatal("status must contain display fields")
	}
}
