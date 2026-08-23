# Installer GUI — bajarilgan ishlar va keyingi reja

Sana: 2026-08-11

## Muammo

Windows o‘rnatuvchi ilova GUI oynasida ishlamayotgan edi. Eski release fayllari:

- `releases/windows/chaqimchi-installer-v1.exe`
- `releases/windows/chaqimchi-installer-v2.exe`
- `releases/windows/chaqimchi-installer-v3.exe`

`PE32+ executable (console)` sifatida build qilingan. Shu sababli ular Windows console subsystem bilan ishlagan.

## Aniqlangan sabab

Installer kodida GUI oqimi mavjud edi, ammo tarqatilgan eski `.exe` fayllar GUI subsystem bilan qayta build qilinmagan.

Installer GUI oqimi quyidagilarni o‘z ichiga oladi:

1. Shaffoflik va rozilik oynasi.
2. QR-kod va 6 xonali bog‘lash kodi oynasi.
3. Ota-ona ilovasi bilan qurilmani bog‘lashni kutish.
4. Xatoliklarni MessageBox orqali ko‘rsatish.

## Hozir bajarilgan ishlar

### 1. GUI installer build yaratildi

Yangi test bootstrap build:

`releases/windows/ChaqimchiAI-Guard-Installer-GUI.exe`

Build parametrlari:

- `GOOS=windows`
- `GOARCH=amd64`
- `-H=windowsgui`
- backend URL: `https://api.chaqimchi-ai.uz`

Fayl `PE32+ executable (GUI)` sifatida tekshirildi.

### 2. Release build gate qo‘shildi

`scripts/windows/build-guard-setup.ps1` ichiga `Assert-GuiExecutable` tekshiruvi qo‘shildi.

Bu tekshiruv installer yoki desktop executable tasodifan console subsystem bilan build qilinsa, release jarayonini to‘xtatadi.

### 3. Cross-compile testlar bajarildi

Windows test binary’lari macOS’da ishga tushirilmaydi, shuning uchun testlar compile-only rejimida tekshirildi:

```bash
GOOS=windows GOARCH=amd64 go test -exec /usr/bin/true ./...
```

Natija: barcha package’lar muvaffaqiyatli compile bo‘ldi.

Eslatma: haqiqiy GUI tekshiruvi Windows 10/11 kompyuterida bajarilishi kerak.

## Muhim eslatma

`ChaqimchiAI-Guard-Installer-GUI.exe` — GUI bootstrap test buildi. To‘liq public installer (`ChaqimchiAI Guard Setup.exe`) Windows release kompyuterida Inno Setup orqali qayta build qilinishi kerak.

Eski `chaqimchi-installer-v1/v2/v3.exe` fayllari GUI tuzatilgan build hisoblanmaydi.

## Keyingi qadamlar

Quyidagi bo‘lim foydalanuvchi bilan kelishilgan yangi reja uchun qoldirildi.

### Next steps

- [ ] 
- [ ] 
- [ ] 

### Release oldidan tekshiruv

- [ ] Windows 10/11’da installer oynasi ochilishini tekshirish.
- [ ] Rozilik oynasi ishlashini tekshirish.
- [ ] QR/kod oynasi ko‘rinishini tekshirish.
- [ ] `api.chaqimchi-ai.uz` orqali enrollment ishlashini tekshirish.
- [ ] Windows Service o‘rnatilishini tekshirish.
- [ ] Toza Windows muhitida uninstall testini bajarish.
- [ ] Final installer’ni imzolash va VirusTotal tekshiruvini bajarish.
