# parent-web testlari

```bash
npm test          # bir marta
npm run test:watch
```

## Nima qoplangan

| Fayl | Nimani ushlaydi |
|---|---|
| `src/api/client.test.ts` | GET cache, `noCache` (Telegram polling bug'i), cache mutatsiyada tozalanishi, in-flight dedup, token parsing, xato matni |
| `src/lib/appDisplay.test.ts` | exe → nom/kategoriya registri, `prettify()` fallback, brend ikonka registri bilan mos kelishi |
| `src/lib/timeline.test.ts` | session → blok aggregation, ≤6 blok kafolati, span/session saqlanishi, `bucketOf` |

## Nega aynan shular

Bular **sof mantiq** — UI render qilmasdan sinaladi, tez ishlaydi va aynan
shu joylarda haqiqiy buglar bo'lgan:

- `noCache` bo'lmagani uchun Telegram login 60 soniya osilib qolgan
- `foldBlocks` bo'lmaganida timeline'da 40+ mayda bo'lak chiqqan

## Nima qoplanmagan (ataylab)

Komponent renderi va vizual holat. Ular uchun `@testing-library/react` kerak,
lekin bu sessiyada topilgan ikkala UI regressiya (tugma ramkasi,
`/login` ga sakrash) DOM testi bilan emas, **brauzerda** ushlangan.
Shuning uchun keyingi qadam — Playwright smoke suite, RTL emas.
