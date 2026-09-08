# Spino24 — Parent Mobile

Expo / React Native client for the Spino24 family digital-wellbeing platform.
Talks to the same Django backend as `parent-web` (`EXPO_PUBLIC_API_URL`,
default `https://api.guard.chaqimchi-ai.uz`).

## Run

```
npm install
npm start        # then press i / a, or scan with Expo Go
```

## Structure

```
src/
  theme.ts              design tokens (colours, spacing, radius, type, shadow) — light only
  api/                  one module per backend area; client.ts = fetch + token refresh + errors
  state/
    session.tsx         auth: hydrate tokens → /me → signedIn | signedOut
    family.tsx          children + devices, selected child / device scope (child = primary entity)
  hooks/
    useQuery.ts          minimal async-data hook (first-load vs background refresh)
    useAlertBadge.ts     unseen-alert count for the tab badge
  components/            design system — primitives, Screen, Sheet, charts, cards, selectors, pickers
  navigation/           RootNavigator → AuthNavigator | (FamilyProvider → AppNavigator tabs)
  screens/              auth · home · activity · rules · alerts · devices · family · enroll · more
```

## What is wired to real data

Home, Activity (Ekran vaqti / Ilovalar / Web-saytlar / Vaqt jadvali), Rules
(daily limit + weekend override, blocked apps, quiet-hours windows), Alerts,
Devices, Family (child CRUD), Pairing (6-digit code), Notification settings
(Telegram), Reports (per-device weekly/monthly), Settings, Privacy.

## Shown as "Rejalashtirilgan" — no backend yet

Per-app time limits, website block/limit rules, instant Device Lock / Internet
Pause, Extra Time requests, co-parenting, location, AI insights, mobile push
(alerts currently go via Telegram). See the design audit for the API list.

## Notes

- Child is the primary entity; screen time is **never summed across a child's
  devices** (they can be used at once). "Barcha qurilmalar" asks you to pick one.
- Tokens live in `expo-secure-store`. UI copy is Uzbek, parent addressed as "Siz".
- No emoji — icons are Feather via `src/components/Icon.tsx`.
```
