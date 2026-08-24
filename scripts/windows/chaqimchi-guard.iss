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
DisableSilentInstall=yes
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
OutputDir={#SourcePath}\..\..\releases\windows
OutputBaseFilename=ChaqimchiAI Guard Setup
SetupIconFile={#SourcePath}\..\..\parent-web\src\app\favicon.ico
UninstallDisplayName=ChaqimchiAI Guard
UninstallDisplayIcon={app}\ChaqimchiAI Guard Installer.exe
VersionInfoVersion={#MyAppVersion}
VersionInfoProductName=ChaqimchiAI Guard
VersionInfoProductVersion={#MyAppVersion}
VersionInfoCompany=ChaqimchiAI
VersionInfoDescription=Parental Control Client
VersionInfoCopyright=© ChaqimchiAI
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2
SolidCompression=yes
; Do not use UPX or other executable packers.

[Languages]
Name: "uz"; MessagesFile: "compiler:Languages\English.isl"

[Files]
Source: "{#BootstrapPath}"; DestDir: "{app}"; DestName: "ChaqimchiAI Guard Installer.exe"; Flags: ignoreversion
Source: "{#DesktopPath}"; DestDir: "{app}"; DestName: "ChaqimchiAI Guard Desktop.exe"; Flags: ignoreversion

[Run]
Filename: "{app}\ChaqimchiAI Guard Installer.exe"; Description: "Qurilmani bog‘lash va Guard Service’ni ishga tushirish"; Flags: postinstall waituntilterminated skipifsilent
Filename: "{app}\ChaqimchiAI Guard Desktop.exe"; Description: "ChaqimchiAI Guard holatini ko‘rsatish"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop ChaqimchiFamilyAgent"; StatusMsg: "ChaqimchiAI Guard Service to‘xtatilmoqda..."; Flags: waituntilterminated
Filename: "{sys}\sc.exe"; Parameters: "delete ChaqimchiFamilyAgent"; StatusMsg: "ChaqimchiAI Guard Service o‘chirilmoqda..."; Flags: waituntilterminated

[UninstallDelete]
Type: filesandordirs; Name: "{commonappdata}\ChaqimchiFamily"

; The binding transparency/consent prompt lives in the bootstrap itself
; (internal/ui.RequireInstallerConsent), shown right before it creates any
; enrollment credentials. A second, differently-worded consent page here
; only duplicated it — a user could accept this wizard page and then decline
; the bootstrap's dialog, leaving files copied with no service configured.
