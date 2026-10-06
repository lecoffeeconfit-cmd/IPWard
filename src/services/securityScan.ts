import { DataMode, LocalReputationList, PrivacyDataset } from '../types';
import { getBehaviorInsights } from './behaviorInsights';
import { SecurityIndicatorSet } from './securityIndicators';

export type SecurityFindingKind = 'indicator' | 'list' | 'behavior' | 'pattern';
export interface SecurityFinding {
  id: string;
  kind: SecurityFindingKind;
  title: string;
  detail: string;
  timestamp: number;
  domain?: string;
  appId?: string | null;
  connectionId?: string;
  source: string;
  advice: string;
}
export interface SecurityCheck {
  id: string;
  title: string;
  status: 'reviewed' | 'needs-data' | 'device-only' | 'desktop-only';
  detail: string;
}
export interface SecurityReview {
  generatedAt: number;
  mode: DataMode;
  sample: boolean;
  recordsReviewed: number;
  indicatorCount: number;
  findings: SecurityFinding[];
  checks: SecurityCheck[];
}

const eventSources = new Set(['demo', 'network-extension', 'vpn-service']);
const connectionAdvice = 'Review the app and destination in Connections. If you do not recognize the activity, update the app and your device, then ask a trusted security professional to assess the evidence.';

function looksEncodedDomain(domain: string): boolean {
  const labels = domain.toLowerCase().split('.');
  const candidate = labels.slice(0, -2).sort((a, b) => b.length - a.length)[0] ?? '';
  if (domain.length < 90 && candidate.length < 38) return false;
  const letters = (candidate.match(/[a-z]/g) ?? []).length;
  const vowels = (candidate.match(/[aeiou]/g) ?? []).length;
  const digits = (candidate.match(/\d/g) ?? []).length;
  return candidate.length >= 30 && (digits >= 6 || (letters >= 18 && vowels / Math.max(1, letters) < 0.16));
}

/** A review of already loaded data, not an operating-system or live-device scan. */
export function buildSecurityReview(
  dataset: PrivacyDataset,
  mode: DataMode,
  indicators: SecurityIndicatorSet | null,
  localReputation: LocalReputationList | null,
  now = Date.now(),
): SecurityReview {
  const events = dataset.connections.filter(event => Number.isFinite(event.timestamp) && event.timestamp <= now);
  const sample = mode === 'demo';
  const findings: SecurityFinding[] = [];
  const domains = new Set(indicators?.domains ?? []);
  const ips = new Set(indicators?.ips ?? []);
  const appIds = new Set(indicators?.appIds ?? []);
  const localDomains = new Set(localReputation?.domains ?? []);
  const appIdentifiers = new Map(dataset.apps.map(app => [app.id, app.identifier.toLowerCase()]));
  const seen = new Set<string>();

  for (const event of events) {
    const domain = event.domain.toLowerCase();
    const appIdentifier = appIdentifiers.get(event.appId ?? '');
    const matched = [domains.has(domain) ? `domain ${domain}` : null, event.ip && ips.has(event.ip) ? `IP ${event.ip}` : null, appIdentifier && appIds.has(appIdentifier) ? `app ID ${appIdentifier}` : null].filter(Boolean);
    if (matched.length) {
      const key = `indicator:${event.appId}:${domain}:${event.ip}`;
      if (!seen.has(key)) {
        findings.push({ id: `ioc-${event.id}`, kind: 'indicator', title: 'Imported indicator match', detail: `Exact match on ${matched.join(', ')}. This indicator file was supplied by you and is not independently verified by IPward.`, timestamp: event.timestamp, domain: event.domain, appId: event.appId, connectionId: event.id, source: indicators?.name ?? 'Imported STIX2', advice: 'Preserve the original report and indicator file. Check the indicator source and context before taking action; a match alone does not establish compromise.' });
        seen.add(key);
      }
    }
    if (localDomains.has(domain)) {
      const key = `list:${event.appId}:${domain}`;
      if (!seen.has(key)) {
        findings.push({ id: `list-${event.id}`, kind: 'list', title: 'User list match', detail: `${event.domain} appears in your imported domain list. The list is a local preference, not a verified threat feed.`, timestamp: event.timestamp, domain: event.domain, appId: event.appId, connectionId: event.id, source: localReputation?.name ?? 'User list', advice: connectionAdvice });
        seen.add(key);
      }
    }
    if (looksEncodedDomain(domain)) {
      const key = `dns-shape:${domain}`;
      if (!seen.has(key)) {
        findings.push({ id: `dns-shape-${event.id}`, kind: 'pattern', title: 'Unusual DNS name shape', detail: `${event.domain} contains a long, encoded-looking label. This can occur in telemetry, content delivery, anti-abuse systems, or DNS tunneling; the name alone is not a threat verdict.`, timestamp: event.timestamp, domain: event.domain, appId: event.appId, connectionId: event.id, source: event.source === 'user-import' ? 'Imported domain record' : 'Observed DNS name', advice: connectionAdvice });
        seen.add(key);
      }
    }
    if (eventSources.has(event.source) && event.bytesMeasured !== false && event.foregroundState === 'background' && event.bytesUploaded >= 10_000_000) {
      const key = `background-upload:${event.appId}:${domain}:${Math.floor(event.timestamp / 86_400_000)}`;
      if (!seen.has(key)) {
        findings.push({ id: `background-upload-${event.id}`, kind: 'pattern', title: 'Large background upload', detail: `${(event.bytesUploaded / 1_000_000).toFixed(1)} MB uploaded to ${event.domain} while the source marked the app as background. Backups and media sync are common explanations; review the app and timing.`, timestamp: event.timestamp, domain: event.domain, appId: event.appId, connectionId: event.id, source: sample ? 'Sample event-level data' : 'Event-level observation', advice: connectionAdvice });
        seen.add(key);
      }
    }
    if (eventSources.has(event.source) && event.bytesMeasured !== false && event.bytesDownloaded >= 50_000_000 && event.category === 'Unknown') {
      const key = `large-download:${event.appId}:${domain}:${Math.floor(event.timestamp / 86_400_000)}`;
      if (!seen.has(key)) {
        findings.push({ id: `large-download-${event.id}`, kind: 'pattern', title: 'Large download from an unclassified destination', detail: `${(event.bytesDownloaded / 1_000_000).toFixed(1)} MB downloaded from ${event.domain}. Large transfers are often legitimate; the provider remains unclassified in the local directory.`, timestamp: event.timestamp, domain: event.domain, appId: event.appId, connectionId: event.id, source: sample ? 'Sample event-level data' : 'Event-level observation', advice: connectionAdvice });
        seen.add(key);
      }
    }
  }

  const behavior = getBehaviorInsights(events, dataset.apps, mode, now);
  for (const item of behavior.findings) {
    findings.push({ id: `behavior-${item.id}`, kind: 'behavior', title: item.title, detail: `${item.description} Low confidence; unusual behavior is not proof of malicious activity.`, timestamp: item.timestamp, domain: item.domain, appId: item.appId, connectionId: item.connectionId, source: `${item.evidenceDays} observed baseline days`, advice: connectionAdvice });
  }

  // Contact cadence is only meaningful when each row is an individual event.
  const groups = new Map<string, typeof events>();
  for (const event of events) {
    if (!event.appId || !event.domain || event.foregroundState !== 'background' || !eventSources.has(event.source)) continue;
    const key = `${event.appId}\u0000${event.domain.toLowerCase()}`;
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 6) continue;
    group.sort((a, b) => a.timestamp - b.timestamp);
    const span = group[group.length - 1].timestamp - group[0].timestamp;
    if (span < 30 * 60_000) continue;
    const gaps = group.slice(1).map((event, index) => event.timestamp - group[index].timestamp);
    const ordered = [...gaps].sort((a, b) => a - b);
    const median = ordered[Math.floor(ordered.length / 2)];
    if (median < 20_000 || median > 15 * 60_000 || gaps.filter(gap => Math.abs(gap - median) <= median * 0.35).length < gaps.length * 0.7) continue;
    const event = group[group.length - 1];
    findings.push({ id: `cadence-${event.appId}-${event.domain}`, kind: 'pattern', title: 'Repeated background contacts', detail: `${group.length} observed contacts with ${event.domain} over ${Math.round(span / 60_000)} minutes. This regular pattern merits review; background traffic is common and this is not a spyware verdict.`, timestamp: event.timestamp, domain: event.domain, appId: event.appId, connectionId: event.id, source: sample ? 'Sample event-level data' : 'Event-level observations', advice: connectionAdvice });
  }

  const indicatorCount = domains.size + ips.size + appIds.size;
  const checks: SecurityCheck[] = [
    { id: 'history', title: 'Network history', status: events.length ? 'reviewed' : 'needs-data', detail: events.length ? `${events.length.toLocaleString()} loaded records reviewed${sample ? ' (sample data)' : ''}. Imported reports are historical, not a live connection feed.` : 'Import an Apple App Privacy Report in Settings to review its historical domain contacts.' },
    { id: 'indicators', title: 'Spyware indicators', status: indicators && events.length ? 'reviewed' : 'needs-data', detail: indicators && events.length ? `Compared records with ${indicatorCount.toLocaleString()} supported exact indicators from “${indicators.name}”. File, process, URL and profile artifacts were not examined.` : 'Import a STIX2 indicator file and load network records to compare exact domains, IPv4 addresses and app IDs.' },
    { id: 'baseline', title: 'Unusual activity', status: behavior.status === 'ready' ? 'reviewed' : 'needs-data', detail: behavior.reason },
    { id: 'local-list', title: 'Your domain list', status: localReputation && events.length ? 'reviewed' : 'needs-data', detail: localReputation && events.length ? `Compared loaded records with ${localReputation.domains.length.toLocaleString()} domains from your imported list.` : 'Add a local domain list in Protect to compare it with loaded records.' },
    { id: 'integrity', title: 'Device integrity & root/jailbreak', status: 'device-only', detail: 'IPward has no device integrity attestation provider connected.' },
    { id: 'apps', title: 'Installed apps, permissions & screen control', status: 'device-only', detail: 'IPward does not have a complete installed-app inventory or Play Integrity app-access verdicts.' },
    { id: 'routing', title: 'VPN, profiles & certificates', status: 'device-only', detail: 'IPward cannot inspect system routing, management profiles or trusted certificates from this screen. Use the guided checks below.' },
    { id: 'updates', title: 'OS security updates', status: 'device-only', detail: 'IPward does not have a verified OS patch-level check. Use your device update settings.' },
    { id: 'forensics', title: 'Deep forensic artifacts', status: 'desktop-only', detail: 'Backups, system logs, process and file artifacts require a separate consensual forensic workflow.' },
  ];

  return { generatedAt: now, mode, sample, recordsReviewed: events.length, indicatorCount, findings: findings.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100), checks };
}
