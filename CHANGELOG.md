# Changelog

## [0.4.0-rc.1] — 2026-08-11

Release candidate. Public release emas; Windows GUI, production DNS/API va security gate’lari hali yakuniy tekshiruvdan o‘tishi kerak.

### Fixed

- Installer GUI subsystem bilan build qilinadigan oqimga o‘tkazildi.
- Eski console-subsystem installerlar arxivlandi.

### Added

- Installer va desktop executable uchun GUI subsystem build gate.
- Shaffoflik/rozilik oynasi va QR/6 xonali enrollment GUI oqimi.
- Release checklist va Windows installer release jarayoni hujjatlari.

### Known limitations

- `api.guard.chaqimchi-ai.uz` DNS/API origin hali tayyor emas.
- To‘liq Inno Setup installer Windows release muhitida hali build qilinmagan.
- Windows 10/11 runtime GUI va Service end-to-end testlari hali bajarilmagan.
- Code signing va VirusTotal gate’lari hali bajarilmagan.

## Planned public release

`0.4.0` public MVP release faqat barcha release checkpointlari PASS bo‘lgandan keyin chiqariladi.
