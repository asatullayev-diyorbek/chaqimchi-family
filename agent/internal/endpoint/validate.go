// Package endpoint validates backend endpoints before the Windows agent uses
// them. Production traffic must use HTTPS; an explicit switch is required for
// local/LAN development over HTTP.
package endpoint

import (
	"fmt"
	"net/url"
	"strings"
)

// ValidateBackendURL accepts HTTPS endpoints. HTTP is allowed only when the
// caller explicitly enables insecure development mode; this prevents an
// accidentally copied production URL from silently sending device credentials
// over plain text.
func ValidateBackendURL(raw string, allowInsecureDevelopment bool) error {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return fmt.Errorf("backend URL must be an absolute URL")
	}
	if u.User != nil {
		return fmt.Errorf("backend URL must not contain user credentials")
	}
	switch strings.ToLower(u.Scheme) {
	case "https":
		return nil
	case "http":
		if allowInsecureDevelopment {
			return nil
		}
		return fmt.Errorf("HTTP backend URL is allowed only with explicit development mode; use HTTPS in production")
	default:
		return fmt.Errorf("backend URL must use HTTPS")
	}
}
