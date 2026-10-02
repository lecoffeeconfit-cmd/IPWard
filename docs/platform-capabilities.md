# Platform capabilities and release plan

IPward's capability service reports what this build can actually access. **Historical import and live observation are separate capabilities.** Sample preview events are fictional even when their example evidence badge says Confirmed or Observed.

| Capability | iOS | Android | This build |
| --- | --- | --- | --- |
| Apple App Privacy Report | User can export the OS `.ndjson` report | Can import a report copied from an Apple device | Local parser, report snapshots, and history implemented. No live feed. |
| App foreground time | Screen Time APIs require Family Controls entitlement and have privacy-preserving limits | `UsageStatsManager` with declared permission and explicit user-granted Usage Access | Android local Expo module implemented. Requires a custom development build and physical-device validation. |
| Live network destinations and bytes | Authorized Network Extension design and entitlement needed | `VpnService`, explicit VPN consent, foreground service, tested routing needed | Not implemented. |
| Per-app network attribution | Must validate an authorized observation source | VPN packets alone do not prove the originating app | Imported Apple report supplies app/domain associations; no live per-app packet attribution. |
| Cross-app sensor access | User-imported OS report supplies access intervals | Ordinary app permissions do not expose other apps' sensor history | Apple report import only. |
| Exact messages, calls, email | Exact iMessage/SMS counts are not exposed; email requires provider OAuth | SMS/call roles and Play policy constraints; email requires OAuth | Unavailable. Architecture refuses unsupported estimates. |
| Tracker blocking | Verified native filtering required | Verified native filtering required | Sample rule simulation only. |

## Evidence handling

- An Apple `networkActivity` row is a **rolling aggregate per app and domain**. `hits` is the reported contact count, and `timeStamp` is its latest contact. IPward does not turn each hit into a fictitious event. Reimporting a matching app/domain updates that aggregate rather than summing overlapping windows.
- An Apple `access` pair marks a resource-access interval. Incomplete pairs are skipped rather than invented. Access does not reveal content recorded, data transfer, or app foreground state.
- Apple's `domainType = 1` is shown as **potential cross-app collection**, not proof of tracking, marketing, or a specific ad's cause. Imported owner labels are attributed to the OS report and are not independently verified.
- Android UsageStats supplies daily foreground-time aggregates. It does not tell IPward whether time was spent messaging or which network requests the app made. Usage data is read from Android when authorized and is not persisted by IPward.
- Imported observations are normalized and stored in app-local SQLite on mobile. The schema has a version number, timestamp index, retention pruning, and parameterized inserts. The browser preview uses a size-limited local fallback. Capture reports and preferences still use AsyncStorage; a full migration and encryption strategy is release work.

## Work required before a production release

1. Build and test the Android module on physical devices across supported Android versions, including permission grant, denial, revocation, locked-device behavior, and calendar-boundary cases. Verify package labels under Android package-visibility limits.
2. Exercise Apple report import on physical iPhones using real exports from current supported iOS releases; test large files, malformed rows, repeated exports, and retention. Validate any data-format changes against Apple's published schema.
3. Decide whether live network monitoring is viable for each platform and distribution channel. Implement and test a lawful, explicitly authorized Network Extension or Android `VpnService`. Verify byte accounting, routing exclusions, lifecycle, battery impact, background execution, and app attribution independently. Do not turn on UI claims before measurements are validated.
4. Add a reviewed endpoint intelligence source with versioned updates, confidence, and an offline fallback. The existing endpoint rules are *demo fixtures*, not a production tracker list.
5. Only connect communication or email sources with appropriate scopes and user authorization. Never infer exact private message counts from bytes or notifications alone.
6. Complete threat modeling, encrypted-storage decision, backup behavior, accessibility and battery tests, privacy policy, app-store metadata, and external security review.

## Primary references

- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)
- [Expo SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [Expo DocumentPicker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/)
- [Apple App Privacy Report format](https://developer.apple.com/documentation/network/inspecting-app-activity-data)
- [Android UsageStatsManager](https://developer.android.com/reference/android/app/usage/UsageStatsManager)
- [Android Usage Access settings](https://developer.android.com/reference/android/provider/Settings#ACTION_USAGE_ACCESS_SETTINGS)
- [Android VpnService](https://developer.android.com/reference/android/net/VpnService)
- [Apple Network Extension entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.networking.networkextension)
