import { DataMode } from '../types';

export type CapabilityKey = 'appleReportImport' | 'networkMonitoring' | 'perAppNetworkAttribution' | 'deviceActivity' | 'notificationActivity' | 'callObservation' | 'smsExactCount' | 'emailIntegration' | 'sensorHistory' | 'locationActivity' | 'trackerBlocking' | 'behaviorBaselines' | 'threatIntelligence';
export interface Capability { key: CapabilityKey; title: string; available: boolean; state: 'available' | 'demo' | 'unavailable'; reason: string; integration: string }
export type CapabilityMatrix = Record<CapabilityKey, Capability>;
export const CAPABILITY_KEYS: CapabilityKey[] = ['appleReportImport', 'networkMonitoring', 'perAppNetworkAttribution', 'deviceActivity', 'notificationActivity', 'callObservation', 'smsExactCount', 'emailIntegration', 'sensorHistory', 'locationActivity', 'trackerBlocking', 'behaviorBaselines', 'threatIntelligence'];
const titles: Record<CapabilityKey, string> = { appleReportImport: 'Apple report import', networkMonitoring: 'Network monitoring', perAppNetworkAttribution: 'App attribution', deviceActivity: 'App usage', notificationActivity: 'Notification activity', callObservation: 'Call observation', smsExactCount: 'Exact message counts', emailIntegration: 'Email integration', sensorHistory: 'Sensor history', locationActivity: 'Location activity', trackerBlocking: 'Tracker blocking', behaviorBaselines: 'Behavior baselines', threatIntelligence: 'Threat reputation' };

/** Native Android app-use totals are available with authorization; no network monitor is connected. */
export function getCapabilities(platform: string, mode: DataMode = 'device', androidUsageAuthorized = false, hasLocalReputationList = false): CapabilityMatrix {
  const ios = platform === 'ios';
  const android = platform === 'android';
  const integrations: Record<CapabilityKey, string> = {
    appleReportImport: 'Available: choose an Apple App Privacy Report .ndjson file. IPward parses domain contacts and sensor access intervals on this device. This is historical import, not live monitoring.',
    networkMonitoring: ios ? 'Requires a native Network Extension, supported use case, entitlement, and explicit VPN consent.' : android ? 'Requires an implemented VpnService, a foreground service, and explicit VPN consent.' : 'Device-wide network observation requires a native mobile build.',
    perAppNetworkAttribution: ios ? 'General per-app attribution must not be assumed from IP packets. An authorized report import may provide app-domain observations.' : android ? 'Requires independently verified app attribution; a VPN interface alone does not label every packet with an app.' : 'A browser cannot attribute other applications’ traffic.',
    deviceActivity: ios ? 'Requires Screen Time entitlement and authorization; privacy-preserving reports are not an unrestricted activity feed.' : android ? 'Requires UsageStatsManager and user-granted usage access.' : 'Usage statistics are not available in the web preview.',
    notificationActivity: android ? 'Requires user-enabled NotificationListenerService. Notification metadata is not a message count.' : 'Cross-app notification history is not exposed through a general consumer iOS API.',
    callObservation: 'No call-state adapter is integrated. App-specific call APIs do not establish universal call history.',
    smsExactCount: ios ? 'Exact iMessage and SMS counts are not exposed to third-party iOS apps.' : 'No eligible SMS role or permission is requested. Network traffic cannot establish exact messages.',
    emailIntegration: 'Requires explicit account connection and least-privilege provider authorization. No account is connected.',
    sensorHistory: 'No cross-app sensor history adapter is integrated. Permission status and access events are different facts.',
    locationActivity: 'IPward’s own location permission cannot reveal other apps’ location access. An imported Apple report can include past location-access intervals.',
    trackerBlocking: 'Requires a native filtering implementation, supported platform permissions, and verified rule enforcement.',
    behaviorBaselines: 'Requires at least three observed days of event-level network records stored locally. Imported Apple report rows are rolling aggregates and cannot support daily comparisons.',
    threatIntelligence: 'No independently verified feed is installed. An optional user-imported exact-domain list is checked locally and is not independently verified.',
  };
  return Object.fromEntries(CAPABILITY_KEYS.map(key => {
    if (key === 'appleReportImport') return [key, { key, title: titles[key], available: true, state: 'available', reason: integrations[key], integration: integrations[key] }];
    if (key === 'deviceActivity' && android && mode === 'device' && androidUsageAuthorized) return [key, { key, title: titles[key], available: true, state: 'available', reason: 'Android Usage Access is granted. IPward can read daily foreground-time aggregates for apps used on this device. This does not reveal in-app activity or message counts.', integration: integrations[key] }];
    if (key === 'threatIntelligence' && hasLocalReputationList) return [key, { key, title: titles[key], available: true, state: 'available', reason: 'A user-imported exact-domain list is installed and checked on this device. Its source and threat type are not independently verified; observed domains are not sent to an external service.', integration: integrations[key] }];
    const demonstrable = mode === 'demo' && key !== 'smsExactCount' && key !== 'trackerBlocking' && key !== 'threatIntelligence';
    return [key, { key, title: titles[key], available: demonstrable, state: demonstrable ? 'demo' : 'unavailable', reason: demonstrable ? 'Illustrative sample data only. This capability is not active on your device.' : integrations[key], integration: integrations[key] }];
  })) as CapabilityMatrix;
}

/** Enforcement must require a real adapter state, never the presence of demo rows. */
export function canMonitorDevice(matrix: CapabilityMatrix): boolean {
  return matrix.networkMonitoring.available && matrix.networkMonitoring.state !== 'demo';
}
