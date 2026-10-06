import { AppProfile, ConnectionEvent, DataMode } from '../types';

export interface AppBaseline {
  appId: string;
  observedDays: number;
  typicalDomains: { low: number; high: number; median: number };
  typicalConnections: { low: number; high: number; median: number };
  typicalUploadedBytes: { low: number; high: number; median: number } | null;
}

export interface BehaviorFinding {
  id: string;
  appId: string;
  appName: string;
  domain?: string;
  type: 'new-destination' | 'destination-spike' | 'connection-spike' | 'upload-spike' | 'new-country' | 'new-asn' | 'night-background';
  title: string;
  description: string;
  timestamp: number;
  connectionId: string;
  evidenceDays: number;
  confidence: 'low';
}

export interface BehaviorInsights {
  status: 'ready' | 'waiting' | 'unavailable';
  sample: boolean;
  baselineWindowDays: number;
  appBaselines: AppBaseline[];
  findings: BehaviorFinding[];
  reason: string;
}

const BASELINE_DAYS = 7;
const MINIMUM_DAYS = 3;
const eligibleSources = new Set(['demo', 'network-extension', 'vpn-service']);

function localDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function range(values: number[]) {
  return { low: Math.min(...values), high: Math.max(...values), median: median(values) };
}

function nameFor(appId: string, apps: readonly AppProfile[]): string {
  return apps.find(app => app.id === appId)?.name ?? 'An unattributed app';
}

/** Analyze only event-level local observations. Apple report rows are rolling aggregates and are excluded. */
export function getBehaviorInsights(
  events: readonly ConnectionEvent[],
  apps: readonly AppProfile[],
  mode: DataMode,
  now = Date.now(),
): BehaviorInsights {
  const todayStart = localDayStart(now);
  const firstBaselineDay = new Date(todayStart);
  firstBaselineDay.setDate(firstBaselineDay.getDate() - BASELINE_DAYS);
  const eligible = events.filter(event =>
    eligibleSources.has(event.source)
    && Number.isFinite(event.timestamp)
    && event.timestamp <= now
    && event.appId !== null
  );
  if (!eligible.length) {
    return {
      status: 'unavailable',
      sample: mode === 'demo',
      baselineWindowDays: BASELINE_DAYS,
      appBaselines: [],
      findings: [],
      reason: mode === 'device'
        ? 'Imported Apple reports contain rolling aggregates per app and domain, not daily connection events. A live observation source is needed to build a baseline.'
        : 'There are no event-level observations to analyze.',
    };
  }

  const appIds = new Set(eligible.map(event => event.appId as string));
  const appBaselines: AppBaseline[] = [];
  const findings: BehaviorFinding[] = [];
  const today = eligible.filter(event => event.timestamp >= todayStart && event.timestamp <= now);

  for (const appId of appIds) {
    const history = eligible.filter(event => event.appId === appId && event.timestamp < todayStart);
    const dayStarts = new Set(history.map(event => localDayStart(event.timestamp)));
    const daily = [...dayStarts]
      .filter(day => day >= firstBaselineDay.getTime() && day < todayStart)
      .sort((a, b) => a - b)
      .map(day => history.filter(event => localDayStart(event.timestamp) === day));
    const domainCounts = daily.map(dayEvents => new Set(dayEvents.map(event => event.domain.toLowerCase())).size);
    const connectionCounts = daily.map(dayEvents => dayEvents.length);
    const measuredUploads = daily.map(dayEvents => dayEvents.filter(event => event.bytesMeasured !== false).reduce((sum, event) => sum + event.bytesUploaded, 0));
    const appBaseline: AppBaseline | null = daily.length
      ? {
          appId,
          observedDays: daily.length,
          typicalDomains: range(domainCounts),
          typicalConnections: range(connectionCounts),
          typicalUploadedBytes: daily.filter(dayEvents => dayEvents.some(event => event.bytesMeasured !== false)).length >= MINIMUM_DAYS
            ? range(measuredUploads.filter((_value, index) => daily[index].some(event => event.bytesMeasured !== false)))
            : null,
        }
      : null;
    if (appBaseline) appBaselines.push(appBaseline);
    if (!appBaseline || appBaseline.observedDays < MINIMUM_DAYS) continue;

    const todayForApp = today.filter(event => event.appId === appId);
    if (!todayForApp.length) continue;

    const earlierDomains = new Set(history.map(event => event.domain.toLowerCase()));
    const earlierCountries = new Set(history.map(event => event.countryCode).filter(code => code && code !== '--'));
    const earlierAsns = new Set(history.map(event => event.asn).filter(asn => asn && asn !== 'Unknown'));
    const reportedCountries = new Set<string>();
    const reportedAsns = new Set<string>();
    for (const event of todayForApp) {
      const domain = event.domain.toLowerCase();
      const newDomain = !earlierDomains.has(domain);
      if (newDomain) {
        findings.push({ id: 'new-' + event.id, appId, appName: nameFor(appId, apps), domain: event.domain, type: 'new-destination', title: 'New destination in local history', description: 'First observed for this app today at ' + new Date(event.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '. This is a change in behavior, not a threat verdict.', timestamp: event.timestamp, connectionId: event.id, evidenceDays: appBaseline.observedDays, confidence: 'low' });
        earlierDomains.add(domain);
      }
      if (event.countryCode && event.countryCode !== '--' && !earlierCountries.has(event.countryCode) && !reportedCountries.has(event.countryCode)) {
        findings.push({ id: `country-${appId}-${event.countryCode}-${todayStart}`, appId, appName: nameFor(appId, apps), domain: event.domain, type: 'new-country', title: 'New destination country in local history', description: `${event.country || event.countryCode} was not present in this app’s prior ${appBaseline.observedDays} observed days. Endpoint location does not establish where data is stored.`, timestamp: event.timestamp, connectionId: event.id, evidenceDays: appBaseline.observedDays, confidence: 'low' });
        reportedCountries.add(event.countryCode);
      }
      if (event.asn && event.asn !== 'Unknown' && !earlierAsns.has(event.asn) && !reportedAsns.has(event.asn)) {
        findings.push({ id: `asn-${appId}-${event.asn}-${todayStart}`, appId, appName: nameFor(appId, apps), domain: event.domain, type: 'new-asn', title: 'New network provider in local history', description: `${event.asn} was not present in this app’s prior ${appBaseline.observedDays} observed days. A new provider is a change to review, not evidence of compromise.`, timestamp: event.timestamp, connectionId: event.id, evidenceDays: appBaseline.observedDays, confidence: 'low' });
        reportedAsns.add(event.asn);
      }
      const hour = new Date(event.timestamp).getHours();
      if (newDomain && event.foregroundState === 'background' && hour < 5) findings.push({ id: `night-${event.id}`, appId, appName: nameFor(appId, apps), domain: event.domain, type: 'night-background', title: 'New overnight background destination', description: `First observed at ${new Date(event.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} while the source marked the app as background. Scheduled sync is a common explanation.`, timestamp: event.timestamp, connectionId: event.id, evidenceDays: appBaseline.observedDays, confidence: 'low' });
    }

    const todayDomains = new Set(todayForApp.map(event => event.domain.toLowerCase())).size;
    const domainThreshold = Math.max(appBaseline.typicalDomains.high + 3, Math.ceil(appBaseline.typicalDomains.median * 1.8));
    if (todayDomains > domainThreshold) {
      const event = todayForApp[todayForApp.length - 1];
      findings.push({
        id: 'domains-' + appId + '-' + todayStart,
        appId,
        appName: nameFor(appId, apps),
        type: 'destination-spike',
        title: 'More destinations than usual',
        description: 'Today: ' + todayDomains + ' domains. Usual observed range: ' + appBaseline.typicalDomains.low + '–' + appBaseline.typicalDomains.high + ' across ' + appBaseline.observedDays + ' observed days.',
        timestamp: event.timestamp,
        connectionId: event.id,
        evidenceDays: appBaseline.observedDays,
        confidence: 'low',
      });
    }

    const connectionThreshold = Math.max(appBaseline.typicalConnections.high + 5, Math.ceil(appBaseline.typicalConnections.median * 2));
    if (todayForApp.length > connectionThreshold) {
      const event = todayForApp[todayForApp.length - 1];
      findings.push({ id: `connections-${appId}-${todayStart}`, appId, appName: nameFor(appId, apps), type: 'connection-spike', title: 'More connections than usual', description: `Today: ${todayForApp.length} events. Usual observed range: ${appBaseline.typicalConnections.low}–${appBaseline.typicalConnections.high} across ${appBaseline.observedDays} observed days.`, timestamp: event.timestamp, connectionId: event.id, evidenceDays: appBaseline.observedDays, confidence: 'low' });
    }

    if (appBaseline.typicalUploadedBytes) {
      const todaysMeasured = todayForApp.filter(event => event.bytesMeasured !== false);
      const todayUpload = todaysMeasured.reduce((sum, event) => sum + event.bytesUploaded, 0);
      const uploadThreshold = Math.max(appBaseline.typicalUploadedBytes.median * 2, appBaseline.typicalUploadedBytes.median + 1_000_000);
      if (todaysMeasured.length && todayUpload > uploadThreshold) {
        const event = todaysMeasured[todaysMeasured.length - 1];
        findings.push({
          id: 'upload-' + appId + '-' + todayStart,
          appId,
          appName: nameFor(appId, apps),
          type: 'upload-spike',
          title: 'More uploaded than usual',
          description: 'Today: ' + (todayUpload / 1_000_000).toFixed(1) + ' MB. Usual median: ' + (appBaseline.typicalUploadedBytes.median / 1_000_000).toFixed(1) + ' MB across ' + appBaseline.observedDays + ' observed days.',
          timestamp: event.timestamp,
          connectionId: event.id,
          evidenceDays: appBaseline.observedDays,
          confidence: 'low',
        });
      }
    }
  }

  const usableBaselines = appBaselines.filter(item => item.observedDays >= MINIMUM_DAYS);
  return {
    status: usableBaselines.length ? 'ready' : 'waiting',
    sample: eligible.some(event => event.source === 'demo'),
    baselineWindowDays: BASELINE_DAYS,
    appBaselines: appBaselines.sort((a, b) => b.observedDays - a.observedDays),
    findings: findings.sort((a, b) => b.timestamp - a.timestamp).slice(0, 30),
    reason: usableBaselines.length
      ? 'Each comparison uses only event-level records saved on this device. It describes unusual activity, not malicious intent.'
      : 'At least three prior observed days are needed before IPward can compare activity with a baseline.',
  };
}
