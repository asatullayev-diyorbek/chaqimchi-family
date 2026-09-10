package screenshot

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"
)

// PutToR2 uploads jpeg to a presigned R2 PUT URL. The Content-Type must
// match what the backend signed ("image/jpeg"), or R2 rejects the request.
func PutToR2(ctx context.Context, uploadURL string, jpeg []byte) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, bytes.NewReader(jpeg))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "image/jpeg")
	req.ContentLength = int64(len(jpeg))
	// A dedicated transport with no env proxy — the URL points straight at R2.
	client := &http.Client{Transport: &http.Transport{}}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("R2 upload rejected: %s", resp.Status)
	}
	return nil
}

func sha256hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}
