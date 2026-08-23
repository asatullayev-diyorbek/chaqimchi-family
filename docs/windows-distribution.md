# Windows tarqatish va Defender/SmartScreen

Ustuvor MVP/Beta siyosati: [Trust & Reputation Strategy](windows-trust-reputation-strategy.md).
Asosiy xavfsizlik siyosati: [Windows Security & Trust](windows-security-trust-guideline.md).

`releases/windows/` ichidagi `v1` fayllar **sinov buildlari**. Ular imzolanmagan,
shuning uchun Windows Defender yoki SmartScreen ogohlantirishi kutiladi. MVP
public release imzosiz bo‘lishi mumkin, ammo u faqat professional installer,
HTTPS, shaffof consent va VirusTotal gate bilan beriladi. Hech qachon
foydalanuvchidan himoyani o‘chirib qo‘yish so‘ralmaydi.

## Code signing mavjud bo‘lgach qo‘shimcha ketma-ketlik

MVP/Beta professional installerini Windows release mashinasida tayyorlash:

```powershell
.\scripts\windows\build-guard-setup.ps1 -Version 0.1.0 -ServerUrl https://api.chaqimchiai.uz
```

Natija yagona public fayl bo‘ladi: `releases/windows/ChaqimchiAI Guard Setup.exe`.
Agent EXE va bootstrap EXE alohida yuklab olish uchun berilmaydi. Build script
Inno Setup va `goversioninfo` talab qiladi, HTTP production endpointni rad
etadi. `goversioninfo` agent va bootstrap EXE’ga icon hamda Windows File
Properties metadata’sini yozadi:

```powershell
go install github.com/josephspurrier/goversioninfo/cmd/goversioninfo@latest
```

1. `ChaqimchiAI` tashkiloti nomiga valid code-signing identity oling. Microsoft
   Artifact Signing (Trusted Signing) yoki ishonchli CA’ning OV sertifikati
   mos; faqat SmartScreen uchun EV sertifikatga ortiqcha pul to‘lash kerak emas.
2. Agent va installer’ni bir xil publisher identity bilan SHA-256 va RFC 3161
   timestamp orqali imzolang. PFX va parolini repoga yoki release papkasiga
   kiritmang.
3. `scripts/windows/sign-release.ps1` bilan imzolang va `signtool verify /pa`
   natijasini release artefakti sifatida saqlang.
4. Buildlarni ngrok emas, kompaniyaga tegishli barqaror HTTPS domenidan bering.
   Har installer sahifasida publisher nomi, privacy tavsifi va SHA-256 hash
   ko‘rinib tursin.
5. Imzolangan clean build noto‘g‘ri aniqlansa, Microsoft Security Intelligence
   portaliga false-positive sifatida yuboring: https://www.microsoft.com/wdsi/filesubmission
6. Foydalanuvchi sessionida ko‘rinadigan interfeysni SYSTEM service ichida
   chizishdan saqlaning; service va user-session helper’ni ajratish lozim.
   Bu Windows Session 0 talabi hamda shaffoflik tamoyiliga mos.

## Imzolash (PFX sertifikati bilan)

Windows SDK’dan `signtool.exe` o‘rnatilgan bo‘lishi kerak:

```powershell
$password = Read-Host "PFX paroli" -AsSecureString
.\scripts\windows\sign-release.ps1 `
  -CertificatePath C:\secure\chaqimchi.pfx `
  -CertificatePassword $password
```

Yuklab olingan faylni tekshirish:

```powershell
.\scripts\windows\verify-release.ps1 .\chaqimchi-installer-v2.exe
```
