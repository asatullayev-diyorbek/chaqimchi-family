; ChaqimchiAI Guard professional Windows installer.
; Compile through build-guard-setup.ps1 — do not distribute the embedded
; bootstrap or agent executable directly.

#ifndef MyAppVersion
  #define MyAppVersion "0.1.0"
#endif
#ifndef BootstrapPath
  #error BootstrapPath is required. Run build-guard-setup.ps1.
#endif
#ifndef DesktopPath
  #error DesktopPath is required. Run build-guard-setup.ps1.
#endif
; The Microsoft Edge WebView2 Evergreen Bootstrapper (~2 MB): agent/installer
; windows render through WebView2 (docs/webview-ui-plan.md); this installs
; the runtime silently when it's missing (Win10 machines that never got Edge
; auto-update; Win11 always has it). Not committed to the repo — downloaded
; fresh by build-guard-setup.ps1 from Microsoft's stable redistribution link.
#ifndef WebView2BootstrapPath
  #error WebView2BootstrapPath is required. Run build-guard-setup.ps1.
#endif
; Numeric a.b.c.d build number for the Windows VersionInfo resource.
; MyAppVersion may carry a pre-release tag (e.g. 0.4.0-rc.1) that these
; fields reject; build-guard-setup.ps1 derives NumericVersion from it.
#ifndef NumericVersion
  #define NumericVersion MyAppVersion
#endif

[Setup]
AppId={{B54D1C3B-08D7-45AF-9F42-4E64B15393A3}
AppName=ChaqimchiAI Guard
AppVersion={#MyAppVersion}
AppPublisher=ChaqimchiAI
AppPublisherURL=https://chaqimchi-ai.uz
AppSupportURL=https://chaqimchi-ai.uz/support
AppUpdatesURL=https://chaqimchi-ai.uz/download
DefaultDirName={autopf}\ChaqimchiAI
DefaultGroupName=ChaqimchiAI Guard
DisableProgramGroupPage=yes
DisableWelcomePage=no
DisableReadyPage=no
DisableFinishedPage=no
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
OutputDir={#SourcePath}\..\..\releases\windows
OutputBaseFilename=ChaqimchiAI Guard Setup
SetupIconFile={#SourcePath}\..\..\parent-web\src\app\favicon.ico
UninstallDisplayName=ChaqimchiAI Guard
UninstallDisplayIcon={app}\ChaqimchiAI Guard Installer.exe
VersionInfoVersion={#NumericVersion}
VersionInfoProductName=ChaqimchiAI Guard
VersionInfoProductVersion={#NumericVersion}
VersionInfoProductTextVersion={#MyAppVersion}
VersionInfoCompany=ChaqimchiAI
VersionInfoDescription=Parental Control Client
VersionInfoCopyright=Copyright (C) ChaqimchiAI
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2
SolidCompression=yes
; Do not use UPX or other executable packers.
; A re-install must not copy over a running tray app or agent. Let Inno close
; in-use files it detects, and stop the service / tray explicitly in
; PrepareToInstall before [Files] runs. Don't force a reboot for this.
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "uz"; MessagesFile: "compiler:Default.isl"

[Code]
// ChaqimchiAI Guard is a transparency-first parental tool: it must never
// install without the child's device user seeing the wizard. Inno Setup 6.4
// removed the [Setup] DisableSilentInstall directive, so enforce the same
// rule here — refuse /SILENT and /VERYSILENT.
function InitializeSetup(): Boolean;
begin
  Result := not WizardSilent();
  if not Result then
    MsgBox('ChaqimchiAI Guard jimgina (silent) o''rnatilmaydi.', mbError, MB_OK);
end;

// WebView2Present checks both registry views (Setup runs 64-bit per
// ArchitecturesInstallIn64BitMode, so the per-machine runtime's key can be
// native HKLM or the WOW6432Node mirror depending on how it was installed)
// for the WebView2 Runtime's client GUID with a non-empty product version.
function WebView2Present(): Boolean;
var
  pv: String;
begin
  Result := False;
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', pv) and (pv <> '') then
    Result := True;
  if not Result then
    if RegQueryStringValue(HKLM32, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', pv) and (pv <> '') then
      Result := True;
end;

// Stop the tray app and the Guard service before any file is copied. On
// Windows a running .exe can't be overwritten; the embedded bootstrap also
// stops the service, but doing it here first keeps the [Files] step clean
// and lets the bootstrap own only the re-install decision. Also installs the
// WebView2 Runtime here if it's missing, so it's ready before the bootstrap
// tries to open its first WebView2 window — a failure here is silently
// survivable (every window falls back to a native dialog), so it is never
// allowed to fail the install.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  rc: Integer;
begin
  Result := '';
  NeedsRestart := False;
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/f /im "ChaqimchiAI Guard Desktop.exe"', '', SW_HIDE, ewWaitUntilTerminated, rc);
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop ChaqimchiFamilyAgent', '', SW_HIDE, ewWaitUntilTerminated, rc);
  Sleep(800);

  if not WebView2Present() then begin
    ExtractTemporaryFile('MicrosoftEdgeWebview2Setup.exe');
    Exec(ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe'), '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, rc);
  end;
end;

[Files]
Source: "{#BootstrapPath}"; DestDir: "{app}"; DestName: "ChaqimchiAI Guard Installer.exe"; Flags: ignoreversion
Source: "{#DesktopPath}"; DestDir: "{app}"; DestName: "ChaqimchiAI Guard Desktop.exe"; Flags: ignoreversion
Source: "{#WebView2BootstrapPath}"; DestDir: "{tmp}"; Flags: dontcopy

[Run]
; The bootstrap (ChaqimchiAI Guard Installer.exe) has a requireAdministrator
; manifest — it writes to {app} and registers a service. Inno Setup runs
; [Run] entries flagged "postinstall" as the *originating* (non-elevated)
; user when Setup itself was elevated, which makes CreateProcess on a
; requireAdministrator target fail with "code 740 / requires elevation".
; runascurrentuser runs it with Setup's already-elevated token instead.
Filename: "{app}\ChaqimchiAI Guard Installer.exe"; Description: "Qurilmani bog‘lash va Guard Service’ni ishga tushirish"; Flags: postinstall waituntilterminated skipifsilent runascurrentuser
Filename: "{app}\ChaqimchiAI Guard Desktop.exe"; Description: "ChaqimchiAI Guard holatini ko‘rsatish"; Flags: postinstall nowait skipifsilent

[UninstallRun]
; The visible desktop/tray companion is launched with "nowait" and keeps
; running in the user's session; without closing it first, uninstall can't
; delete its .exe and leaves {app} behind. taskkill runs before the service
; teardown so its file is unlocked by the time [UninstallDelete] runs.
Filename: "{sys}\taskkill.exe"; Parameters: "/f /im ""ChaqimchiAI Guard Desktop.exe"""; RunOnceId: "StopGuardDesktop"; Flags: waituntilterminated runhidden
Filename: "{sys}\sc.exe"; Parameters: "stop ChaqimchiFamilyAgent"; RunOnceId: "StopGuardService"; StatusMsg: "ChaqimchiAI Guard Service to‘xtatilmoqda..."; Flags: waituntilterminated
Filename: "{sys}\sc.exe"; Parameters: "delete ChaqimchiFamilyAgent"; RunOnceId: "DeleteGuardService"; StatusMsg: "ChaqimchiAI Guard Service o‘chirilmoqda..."; Flags: waituntilterminated

[UninstallDelete]
Type: filesandordirs; Name: "{commonappdata}\ChaqimchiFamily"

; The binding transparency/consent prompt lives in the bootstrap itself
; (internal/ui.RequireInstallerConsent), shown right before it creates any
; enrollment credentials. A second, differently-worded consent page here
; only duplicated it — a user could accept this wizard page and then decline
; the bootstrap's dialog, leaving files copied with no service configured.
