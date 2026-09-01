//go:build windows

package webwin

import "encoding/json"

// ShowWelcome renders welcome.html (installer window 1) and blocks until the
// operator chooses to continue or cancels/closes. Returns true to proceed.
func ShowWelcome() (bool, error) {
	w, err := New(Options{
		Page:   "welcome.html",
		Title:  "ChaqimchiAI Guard — Xush kelibsiz",
		Width:  960,
		Height: 620,
	})
	if err != nil {
		return false, err
	}
	proceed := false
	w.OnAction(func(name string, _ json.RawMessage) {
		if name == "continue" {
			proceed = true
		}
		w.Close()
	})
	w.Run()
	return proceed, nil
}
