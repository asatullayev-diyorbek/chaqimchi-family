package endpoint

import "testing"

func TestValidateBackendURL(t *testing.T) {
	tests := []struct {
		name      string
		url       string
		allowHTTP bool
		wantErr   bool
	}{
		{"production HTTPS", "https://api.chaqimchiai.uz", false, false},
		{"local HTTP needs explicit development mode", "http://localhost:8000", false, true},
		{"explicit development HTTP", "http://localhost:8000", true, false},
		{"public HTTP rejected", "http://api.example.com", false, true},
		{"unsupported scheme", "ftp://example.com", false, true},
		{"relative URL", "/api", false, true},
		{"URL userinfo rejected", "https://secret@example.com", false, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateBackendURL(tt.url, tt.allowHTTP)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ValidateBackendURL(%q, %v) error = %v, wantErr %v", tt.url, tt.allowHTTP, err, tt.wantErr)
			}
		})
	}
}
