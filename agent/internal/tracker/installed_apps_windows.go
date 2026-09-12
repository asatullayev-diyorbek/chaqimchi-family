//go:build windows

// Installed-apps inventory scan. Runs entirely from the SYSTEM service — no
// session-bridge helper needed, since reading HKEY_USERS\<SID>\... doesn't
// require impersonation, just the SID string.
package tracker

import (
	"encoding/base64"
	"strconv"
	"strings"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// iconPathFromDisplayIcon strips the optional ",<index>" resource-index
// suffix registry uninstall entries often append to DisplayIcon (e.g.
// `C:\Program Files\App\app.exe,0`), and rejects bare .ico-only values with
// no exe fallback since ExtractIconPNG needs a real PE file to query.
func iconPathFromDisplayIcon(raw string) string {
	raw = strings.Trim(strings.TrimSpace(raw), `"`)
	if raw == "" {
		return ""
	}
	if i := strings.LastIndex(raw, ","); i > 0 {
		if _, err := strconv.Atoi(strings.TrimSpace(raw[i+1:])); err == nil {
			raw = strings.TrimSpace(raw[:i])
		}
	}
	if !strings.HasSuffix(strings.ToLower(raw), ".exe") {
		return ""
	}
	return raw
}

// ScanInstalledApps enumerates real, user-facing programs from the
// registry's Uninstall keys: system-wide (HKLM, both 64- and 32-bit views)
// plus the currently logged-in interactive user's own hive (many common
// apps — Discord, per-user Chrome, Telegram Desktop — install only there).
func ScanInstalledApps() []InstalledAppInfo {
	seen := map[string]InstalledAppInfo{}

	scanKey := func(root registry.Key, path string, flags uint32) {
		k, err := registry.OpenKey(root, path, registry.ENUMERATE_SUB_KEYS|flags)
		if err != nil {
			return
		}
		defer k.Close()

		names, err := k.ReadSubKeyNames(-1)
		if err != nil {
			return
		}
		for _, name := range names {
			if app, ok := readAppEntry(root, path+`\`+name, flags); ok {
				seen[app.Name] = app
			}
		}
	}

	const uninstallPath = `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`
	scanKey(registry.LOCAL_MACHINE, uninstallPath, registry.WOW64_64KEY)
	scanKey(registry.LOCAL_MACHINE, uninstallPath, registry.WOW64_32KEY)

	if sid := currentUserSID(); sid != "" {
		scanKey(registry.USERS, sid+`\`+uninstallPath, 0)
	}

	out := make([]InstalledAppInfo, 0, len(seen))
	for _, app := range seen {
		out = append(out, app)
	}
	return out
}

func readAppEntry(root registry.Key, path string, flags uint32) (InstalledAppInfo, bool) {
	k, err := registry.OpenKey(root, path, registry.QUERY_VALUE|flags)
	if err != nil {
		return InstalledAppInfo{}, false
	}
	defer k.Close()

	name, _, err := k.GetStringValue("DisplayName")
	if err != nil || strings.TrimSpace(name) == "" {
		return InstalledAppInfo{}, false
	}
	uninstallCmd, _, _ := k.GetStringValue("UninstallString")
	if strings.TrimSpace(uninstallCmd) == "" {
		return InstalledAppInfo{}, false
	}
	if systemComponent, _, err := k.GetIntegerValue("SystemComponent"); err == nil && systemComponent == 1 {
		return InstalledAppInfo{}, false
	}
	if parent, _, err := k.GetStringValue("ParentKeyName"); err == nil && parent != "" {
		return InstalledAppInfo{}, false
	}
	if noisePattern.MatchString(name) {
		return InstalledAppInfo{}, false
	}

	version, _, _ := k.GetStringValue("DisplayVersion")
	publisher, _, _ := k.GetStringValue("Publisher")
	installDate, _, _ := k.GetStringValue("InstallDate")

	info := InstalledAppInfo{
		Name:        name,
		Version:     version,
		Publisher:   publisher,
		InstallDate: parseInstallDate(installDate),
	}
	if displayIcon, _, _ := k.GetStringValue("DisplayIcon"); displayIcon != "" {
		if exePath := iconPathFromDisplayIcon(displayIcon); exePath != "" {
			if png, sha, err := ExtractIconPNG(exePath); err == nil && len(png) > 0 {
				info.IconSha256 = sha
				info.IconB64 = base64.StdEncoding.EncodeToString(png)
			}
		}
	}
	return info, true
}

// currentUserSID returns the SID (as a string) of whoever is at the active
// console session, or "" if no one is logged on.
func currentUserSID() string {
	session := windows.WTSGetActiveConsoleSessionId()
	if session == 0xFFFFFFFF {
		return ""
	}
	var token windows.Token
	if err := windows.WTSQueryUserToken(session, &token); err != nil {
		return ""
	}
	defer token.Close()

	user, err := token.GetTokenUser()
	if err != nil {
		return ""
	}
	return user.User.Sid.String()
}
