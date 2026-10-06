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
| Rule actions and targets | Network Extension filter required for enforcement | VpnService filter required for enforcement | Local evaluation supports allow/block/alert/ignore against exact domains, IPv4 addresses/ranges, ASN, country code, provider organization, and destination category. Temporary rules expire locally. It does not enforce a network decision. |
| Protection profiles | Native filtering required for enforcement | Native filtering required for enforcement | Standard, Privacy, Strict Privacy, and High-Risk profiles apply grouped settings and profile-managed local rule previews. They do not imply live blocking. |
| Behavior baselines | Requires event-level local observations | Requires event-level local observations | Compares up to seven prior observed days after three or more days exist; imported Apple rolling aggregates are excluded. |
| Threat reputation | User may import a local domain or hosts file | User may import a local domain or hosts file | Optional exact-domain checks run on-device. The file's source/type is not independently verified, and observed domains are never sent to a reputation service. |
| Security Center review | Historical app/domain report fields | Historical records and event-level observations if a provider supplies them | Quick and network review of loaded evidence; exact user-imported STIX2 domain, IPv4 and app-ID matches; local list matches; low-confidence behavior clues; event timeline; guided checks; JSON export. No clean-device verdict. |
| Phone speed | In-app JavaScript timing while foregrounded | In-app JavaScript timing while foregrounded | User-started timer, frame-callback and small-task measurements. Up to twelve local runs, same-installation release-build baseline comparisons, result history and report export. Cannot time other apps or detect Pegasus from slowness. |
| Connection diagnostics | `expo-network` reports the current connection type and OS reachability when available | `expo-network` can additionally identify a Bluetooth-tethered network route | User-started Cloudflare internet check estimates response time, variation, download, and upload. Quick transfers 250 KB down and 100 KB up; standard transfers 2 MB down and 1 MB up, plus request overhead. Up to twelve results stay local, can be cleared, and the latest can be exported in a security report. No router Wi-Fi link rate, cellular plan usage, or direct Bluetooth accessory speed is measured. A new development build may be needed for the native connection-type module. |
| Current network review | Current connection type and local IP are available to the app when the OS reports them | Current connection type and local IP are available to the app when the OS reports them | Displays the local IP transiently and offers a persistent self-review checklist. It does not enumerate peers, scan the LAN, inspect the router, or save the IP in activity history. |
| Privacy Map and exposure scores | Uses locally loaded/imported evidence | Uses locally loaded/imported evidence | Builds an app-to-data-to-recipient-to-purpose review map and exposure-priority scores. Scores are explainable review aids, not safety, security, compliance, or risk verdicts. |
| Account export inventory | User chooses a local JSON, NDJSON, or CSV file | User chooses a local JSON, NDJSON, or CSV file | Parses locally and stores only category counts plus representative field paths; raw values are discarded. Full archive traversal and provider login are not implemented. |
| Web URL review | User pastes a URL | User pastes a URL | Local heuristic review of HTTPS, URL shape, common tracking/redirect parameters, imported local lists, and bundled provider hints. No browser-history access, live reputation lookup, or Safari/Chrome extension. |
| Readable PDF report | Native print pipeline | Native print pipeline | Native Settings export creates an explicitly requested activity-summary PDF in temporary app cache and opens the share sheet. Web retains JSON/CSV downloads. |
| Device integrity, installed apps, privileged access | Restricted by app sandbox and entitlements | Requires native APIs, distribution review and in some cases verified Play Integrity integration | Guided checks only. No OS attestation or complete installed-app/permission inventory. |
| Continuous threat monitoring | Authorized Network Extension needed | Consented VPN or other validated provider needed | Re-evaluates the records currently loaded in the Security Center; no live device-wide monitor. |
| Deep forensic scan | Backup and log analysis outside ordinary app sandbox | Backup and log analysis with a consensual workflow | MVT documentation and handoff guidance only; no desktop companion or forensic artifact scan. |
| First-seen notices | Import history only | Import history only | Compares app/domain rows with IPward's local import history; does not imply the app recently added a destination. |
| Weekly privacy digest | Imported report fields only | Imported report fields only | Seven-day local summary; missing OS fields remain unavailable. |
| Ask IPward | Local report evidence only | Local report evidence only | On-device rules-based explanation; no connected AI service and no payload inspection. |

## Evidence handling

- An Apple `networkActivity` row is a **rolling aggregate per app and domain**. `hits` is the reported contact count, and `timeStamp` is its latest contact. IPward does not turn each hit into a fictitious event. Reimporting a matching app/domain updates that aggregate rather than summing overlapping windows.
- An Apple `access` pair marks a resource-access interval. Incomplete pairs are skipped rather than invented. Access does not reveal content recorded, data transfer, or app foreground state.
- Apple's `domainType = 1` is shown as **potential cross-app collection**, not proof of tracking, marketing, or a specific ad's cause. Imported owner labels are attributed to the OS report and are not independently verified. A small offline suffix directory provides estimated company/category hints for selected common providers; it is incomplete, can identify infrastructure rather than a data recipient, and is not a maintained tracker database.
- Android UsageStats supplies daily foreground-time aggregates. It does not tell IPward whether time was spent messaging or which network requests the app made. Usage data is read from Android when authorized and is not persisted by IPward.
- Imported observations are normalized and stored in app-local SQLite on mobile. The schema has a version number, timestamp index, retention pruning, and parameterized inserts. The browser preview uses a size-limited local fallback. Capture reports and preferences still use AsyncStorage; a full migration and encryption strategy is release work.
- Connection speed checks run only on request. They send a bounded test payload to Cloudflare, which can see the device's public IP address. The result describes the internet path to that server at that time, not the Wi-Fi radio's negotiated rate. A direct Bluetooth transfer test requires a compatible paired peer and is not available in this build.
- Account-export inventory runs only after the user chooses a file. It stores counts and example field paths, not the raw field values, and the saved inventory can be removed individually or with Clear history.
- URL review is local and heuristic. A low review priority is not a claim that a site is safe; a high priority is not a malware verdict.

## Work required before a production release

1. Build and test the Android module on physical devices across supported Android versions, including permission grant, denial, revocation, locked-device behavior, and calendar-boundary cases. Verify package labels under Android package-visibility limits.
2. Exercise Apple report import on physical iPhones using real exports from current supported iOS releases; test large files, malformed rows, repeated exports, and retention. Validate any data-format changes against Apple's published schema.
3. Decide whether live network monitoring is viable for each platform and distribution channel. Implement and test a lawful, explicitly authorized Network Extension or Android `VpnService`. Verify byte accounting, routing exclusions, lifecycle, battery impact, background execution, and app attribution independently. Do not turn on UI claims before measurements are validated.
4. Replace the small offline provider-hint directory with a reviewed endpoint intelligence source with versioned updates, confidence, and a reliable offline fallback. The existing directory is incomplete, and demo endpoint rules are still fictional fixtures rather than a production tracker list.
5. If adding a maintained reputation feed, choose a reviewed source and a privacy-preserving update design. The current optional import is user-supplied and unverified; reputation stays distinct from advertising/tracking labels, and no domain lookups are sent externally.
6. For native Security Center checks, obtain and validate Apple Network Extension capability where applicable, build a consented Android observation source, and set up a verified Play Integrity backend before using its device, Play Protect, or app-access verdicts. Add native system checks only where the OS and store policies permit them. Choose a maintained indicator source with licensing and update review. Build and independently validate any desktop forensic workflow, including MVT license and consent requirements.
7. Only connect communication or email sources with appropriate scopes and user authorization. Never infer exact private message counts from bytes or notifications alone.
8. Complete threat modeling, encrypted-storage decision, backup behavior, accessibility and battery tests, privacy policy, app-store metadata, and external security review.

## Primary references

- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Network](https://docs.expo.dev/versions/v57.0.0/sdk/network/)
- [Cloudflare speed-test endpoint reference](https://github.com/cloudflare/speedtest)
- [Expo SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [Expo DocumentPicker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/)
- [Expo Print](https://docs.expo.dev/versions/v57.0.0/sdk/print/)
- [Expo Sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/)
- [Apple App Privacy Report format](https://developer.apple.com/documentation/network/inspecting-app-activity-data)
- [Android UsageStatsManager](https://developer.android.com/reference/android/app/usage/UsageStatsManager)
- [Android Usage Access settings](https://developer.android.com/reference/android/provider/Settings#ACTION_USAGE_ACCESS_SETTINGS)
- [Android VpnService](https://developer.android.com/reference/android/net/VpnService)
- [Apple Network Extension entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.networking.networkextension)
- [Android Play Integrity verdicts](https://developer.android.com/google/play/integrity/verdicts)
- [Mobile Verification Toolkit indicators](https://docs.mvt.re/en/latest/iocs/)
- [Apple Lockdown Mode](https://support.apple.com/105120)
- [React Native 0.86 performance timing](https://reactnative.dev/docs/0.86/global-performance)
- [Apple: If your iPhone or iPad is running slow](https://support.apple.com/en-gb/102598)
