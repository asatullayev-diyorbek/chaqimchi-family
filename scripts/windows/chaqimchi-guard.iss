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

[Code]
var
  TransparencyPage: TInputOptionWizardPage;

procedure InitializeWizard;
begin
  TransparencyPage := CreateInputOptionPage(
    wpWelcome,
    'Shaffoflik va rozilik',
    'ChaqimchiAI Guard nima o‘rnatishini tasdiqlang',
    'O‘rnatiladi: Windows Service, avtomatik ishga tushish, qurilma holati va ekran vaqti monitoringi, xavfsiz HTTPS aloqa. ' +
    'Kuzatilmaydi: parollar, shaxsiy fayllar, kamera, mikrofon yoki klaviatura bosishlari.',
    False,
    True);
  TransparencyPage.Add('Ma’lumotlarni o‘qidim va ChaqimchiAI Guard o‘rnatilishiga roziman.');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = TransparencyPage.ID then begin
    if not TransparencyPage.SelectedValue[0] then begin
      MsgBox('Davom etish uchun shaffoflik ma’lumotlarini tasdiqlashingiz kerak.', mbInformation, MB_OK);
      Result := False;
    end;
  end;
end;
