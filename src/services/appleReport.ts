import { AppProfile, ConnectionEvent, Organization, PrivacyDataset, SensorEvent, SensorType } from '../types';
import { inferProviderHint } from './providerHints';
import { utf8ByteLength } from '../utils/export';

const MAX_BYTES = 12_000_000;
const MAX_ROWS = 40_000;
const sensors: Record<string, SensorType> = {
  camera: 'Camera', microphone: 'Microphone', location: 'Location',
  contacts: 'Contacts', photos: 'Photos', mediaLibrary: 'Photos',
};
type Row = Record<string, unknown>;
const object = (value: unknown): value is Row => value !== null && typeof value === 'object' && !Array.isArray(value);
const field = (value: unknown, max = 253) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const timestamp = (value: unknown): number | null => {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time > 0 && time < Date.now() + 86_400_000 ? time : null;
};
const validDomain = (domain: string) => domain.length <= 253 && domain.includes('.') && domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
const stableId = (text: string) => {
  let first = 2166136261;
  let second = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    first = Math.imul(first ^ char, 16777619);
    second = Math.imul(second ^ char, 2246822519);
  }
  return `${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
};
const appName = (bundleId: string) => bundleId.split('.').filter(Boolean).pop()?.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || bundleId;

export interface AppleReportResult {
  dataset: PrivacyDataset;
  skipped: number;
  networkRecords: number;
  sensorIntervals: number;
  totalContacts: number;
}

/** Parses the user's Apple App Privacy Report locally. A network row is an aggregate,
 *  so its latest timestamp must not be mistaken for every one of its `hits`. */
export function parseApplePrivacyReport(content: string): AppleReportResult {
  if (utf8ByteLength(content) > MAX_BYTES) throw new Error('Report is larger than the 12 MB import limit.');
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length > MAX_ROWS) throw new Error('Report has too many records.');
  const apps = new Map<string, AppProfile>();
  const organizations = new Map<string, Organization>();
  const connections = new Map<string, ConnectionEvent>();
  const accessBegins = new Map<string, { appId: string; sensor: SensorType; time: number }>();
  const sensorEvents = new Map<string, SensorEvent>();
  let skipped = 0;
  let recognized = 0;
  const ensureApp = (bundleId: string) => {
    const id = `apple:${bundleId}`;
    if (!apps.has(id)) {
      const name = appName(bundleId);
      apps.set(id, { id, identifier: bundleId, name, initials: name.slice(0, 2).toUpperCase(), color: '#7EA5D8', icon: 'grid', category: 'Imported app', permissions: [], source: 'user-import' });
    }
    return id;
  };
  for (const line of lines) {
    let row: unknown;
    try { row = JSON.parse(line); } catch { skipped++; continue; }
    if (!object(row)) { skipped++; continue; }
    if (row.type === 'networkActivity') {
      recognized++;
      const domain = field(row.domain).toLowerCase().replace(/\.$/, '');
      const bundle = field(row.bundleID, 300);
      const time = timestamp(row.timeStamp);
      const firstTime = timestamp(row.firstTimeStamp);
      if (!validDomain(domain) || !bundle || time === null) { skipped++; continue; }
      // The Apple row summarizes a rolling window. Replace the same app/domain
      // on reimport instead of summing overlapping seven-day hit counts.
      const id = `apple-network:${stableId(`${bundle}|${domain}`)}`;
      const owner = field(row.domainOwner, 120);
      const providerHint = inferProviderHint(domain);
      const organizationName = owner || providerHint?.company || null;
      const organizationId = owner ? `apple-owner:${stableId(owner.toLowerCase())}` : providerHint ? `hint-company:${stableId(providerHint.company.toLowerCase())}` : null;
      if (organizationId && !organizations.has(organizationId)) {
        organizations.set(organizationId, { id: organizationId, name: organizationName!, initials: organizationName!.slice(0, 2).toUpperCase(), color: '#8EA5BD', description: owner ? 'Domain owner label supplied by the imported Apple report; ownership has not been independently verified by IPward.' : 'Likely provider inferred from a bundled domain suffix hint. This may identify infrastructure rather than the recipient of personal data.' });
      }
      const hits = typeof row.hits === 'number' && Number.isSafeInteger(row.hits) && row.hits > 0 ? row.hits : 1;
      const potentialTracker = row.domainType === 1;
      const explanation = `Apple App Privacy Report lists ${hits} contact${hits === 1 ? '' : 's'} with this domain during its reporting window. The timestamp is the most recent contact${firstTime !== null && firstTime <= time ? ', and the first contact time is also available' : ''}. Intermediate contact times are unavailable. IPward cannot determine bytes, payload, server location, or whether the app was foregrounded.${potentialTracker ? ' Apple marks this domain as potentially collecting information across apps or sites; this is not proof of tracking in this instance.' : ''}`;
      const existing = connections.get(id);
      if (existing && existing.timestamp > time) continue;
      connections.set(id, {
        id, timestamp: time, appId: ensureApp(bundle), domain, ip: '', port: 0, protocol: 'Unknown', organizationId,
        country: 'Unavailable', countryCode: '', region: '', asn: '', bytesUploaded: 0, bytesDownloaded: 0,
        bytesMeasured: false, reportHits: hits, reportFirstAt: firstTime !== null && firstTime <= time ? firstTime : undefined, potentialTracker, foregroundState: 'unknown', category: providerHint?.categories[0] ?? 'Unknown',
        classification: providerHint
          ? { domain, organizationId, categories: providerHint.categories, confidence: 'medium', source: 'bundled-provider-hints', lastUpdated: '2026-10-01', explanation: `${providerHint.note}, inferred from a bundled domain suffix hint. It is not an authoritative owner or tracker database. Apple's potential cross-app flag is displayed separately.` }
          : { domain, organizationId, categories: ['Unknown'], confidence: 'low', source: 'unknown', lastUpdated: '', explanation: owner ? 'Apple supplied a domain owner label, but IPward has no category hint for this endpoint. Its purpose remains unknown.' : 'No domain owner or endpoint classification is available. Apple’s potential cross-app collection flag is shown separately.' },
        isNewDestination: false, source: 'user-import', provenance: { state: 'Confirmed', source: 'user-import', confidence: 'high', explanation },
      });
    } else if (row.type === 'access') {
      recognized++;
      const accessor = object(row.accessor) ? field(row.accessor.identifier, 300) : '';
      const sensor = sensors[field(row.category)];
      const time = timestamp(row.timeStamp);
      const identifier = field(row.identifier, 100);
      if (!accessor || !sensor || time === null || !identifier) { skipped++; continue; }
      const appId = ensureApp(accessor);
      const key = `${accessor}|${identifier}`;
      if (row.kind === 'intervalBegin') accessBegins.set(key, { appId, sensor, time });
      else if (row.kind === 'intervalEnd') {
        const begin = accessBegins.get(key);
        if (!begin || begin.sensor !== sensor || begin.time > time) { skipped++; continue; }
        const id = `apple-access:${stableId(key + '|' + begin.time)}`;
        sensorEvents.set(id, { id, timestamp: begin.time, timestampEnd: time, appId, sensor, foregroundState: 'unknown', source: 'user-import', provenance: { state: 'Confirmed', source: 'user-import', confidence: 'high', explanation: 'Access interval recorded in a user-imported Apple App Privacy Report. App foreground state and the contents accessed are unavailable.' } });
        accessBegins.delete(key);
      } else skipped++;
    }
  }
  if (!recognized) throw new Error('This file has no Apple App Privacy Report activity records. Select an exported .ndjson report.');
  // Incomplete intervals are not presented as measured durations.
  skipped += accessBegins.size;
  const data: PrivacyDataset = { mode: 'device', generatedAt: Date.now(), apps: [...apps.values()], organizations: [...organizations.values()], connections: [...connections.values()].sort((a, b) => b.timestamp - a.timestamp), sensors: [...sensorEvents.values()].sort((a, b) => b.timestamp - a.timestamp), communications: [], alerts: [] };
  return { dataset: data, skipped, networkRecords: data.connections.length, sensorIntervals: data.sensors.length, totalContacts: data.connections.reduce((sum, event) => sum + (event.reportHits ?? 1), 0) };
}
