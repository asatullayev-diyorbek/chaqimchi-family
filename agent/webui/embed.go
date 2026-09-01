// Package webui holds the ChaqimchiAI Guard / Child window pages (the same
// HTML/CSS that lives here as a browsable design set) and embeds them into
// the agent binary so the WebView2 windows can be served over loopback with
// no external files. See docs/webview-ui-plan.md.
package webui

import "embed"

//go:embed *.html style.css assets
var Files embed.FS
