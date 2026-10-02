# IPward

IPward is a local-first privacy activity utility built with Expo SDK 57, React Native, TypeScript, and Expo Router. It has a clearly labelled sample preview plus a device workspace that accepts authorized evidence. The app never presents sample events as activity from the user's phone.

## Run

```sh
npm install
npm run web
```

For iOS and Android, run `npm run ios` or `npm run android` in a configured native development environment. A **new Android development build** is needed for the bundled Usage Access module; Expo Go cannot load custom native code. The module does not grant itself permission. In Settings, the user opens Android Usage Access settings and explicitly enables IPward. Returning to the app or tapping Refresh reads the OS daily foreground-time totals. A native Android build has not yet been compiled on this machine.

## What works with actual user data

- **Apple App Privacy Report import:** On iPhone or iPad, enable App Privacy Report in Settings → Privacy & Security. Use its Share action to save the `.ndjson` report, then choose it in IPward Settings. IPward parses domain-contact summaries and sensor access intervals on-device. It keeps the report's source and provenance, rejects unrelated or oversized files, skips invalid records, and deduplicates repeated imports by app and domain. The latest imported aggregate replaces an overlapping one.
- **Historical report snapshots:** Save all imported records or focus on one reported app. Compare two snapshots of the same source. Snapshots are explicitly labelled historical, never live captures.
- **Android app use:** With user-granted Usage Access in a custom development build, IPward reads daily foreground-time aggregates from Android `UsageStatsManager` and shows them in Activity and Apps. This does not reveal in-app content, messages, calls, or network traffic. Android may aggregate usage into calendar-day buckets.
- **Local storage:** On iOS and Android, imported normalized events and profile labels use a versioned SQLite store with indexed timestamps and retention pruning. The web preview uses a bounded AsyncStorage fallback. Preferences, demo rules, and saved reports use app-local storage. There is no cloud activity backend. The database is not encrypted by IPward; device storage protections apply.
- **Export:** JSON and CSV include provenance and leave unavailable transfer bytes blank. A native share sheet or web download starts only after an explicit action. Native export files are stored temporarily in app cache; Settings can clear them, and Clear history clears them with imported observations.

## Product experience

Five primary tabs, responsive navigation, dark/light mode, reduced motion, evidence labels, Overview, Activity, Apps, Connections, Protect, sensor and communication views, destinations, notices, trust center, search, filters, demo captures, local report comparison, retention, and settings are implemented. The visual system uses sculpted instrument panels, an animated count dial, an animated outbound trace, and spring-press controls. The dial's motion is decorative; its center number is the reported count. In Sample preview, all events and classifications are fictional fixtures. Demo protection rules only simulate domain matches.

The **Data & ads** view combines imported sensor access intervals and domain contacts into an app-filtered timeline. It shows each sensor interval's start and end, and the latest contact time and aggregate count for each Apple domain row. Potential cross-app collection flags and report-supplied domain owners are shown with their limits. Users can review category-specific steps for revoking an app's permission and changing tracking or ad preferences. On Android, a compatible development build can open an observed Android app's system settings; IPward cannot change another app's permission itself. Apple report apps must be controlled on the originating Apple device. A new native build is needed after adding `expo-intent-launcher`.

## Limits that remain

IPward does **not** yet include a live device-wide network VPN/Network Extension provider, per-app packet attribution, transfer-byte accounting from real traffic, actual tracker enforcement, device-wide background network history, cross-app sensor monitoring, calls/SMS access, notification listening, or an email OAuth integration. Apple report imports do not expose bytes, IP addresses, server geography, foreground state, or payloads; those fields remain unavailable in the UI. Android Usage Access provides time aggregates only. IPward cannot read spoken or typed words from other apps, identify which ad appeared or its receiving app, prove why an ad was selected, or directly revoke another app's permissions. Exact message counts and ad causation are not inferred.

The Android native module is source-complete and autolinked, but still needs an Android development build and device validation before release. iOS App Privacy Report import is implemented in JavaScript and builds for iOS, but has not been exercised on a physical iPhone in this environment. No App Store or Play Store release, security audit, production privacy policy, or native network-entitlement review has been completed. This is a substantial product foundation, **not yet a production-ready device-wide monitor**. See [docs/platform-capabilities.md](docs/platform-capabilities.md).

## Checks

```sh
npm run typecheck
npm run lint
npm test
npx expo export --platform all
npx expo-doctor
```

Tests cover Apple report parsing, provenance, deduplication, snapshot validation, classification boundaries, capability gating, range filters, estimation guards, capture comparison, CSV safety, and persistence validation. The browser Settings screen and app navigation have been inspected in the local preview.

`expo-doctor` also uses online Expo and React Native Directory metadata checks. If those hosts are unreachable, its offline checks can pass while those two checks remain unverified.
