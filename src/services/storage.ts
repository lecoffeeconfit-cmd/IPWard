import { AdSighting, CaptureSession, ConnectionEvent, DataMode, NewDomainNotice, Provenance, SensorEvent } from '../types';
import { summarizeConnections } from './analytics';

export interface KeyValueStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
export interface PrivacyPreferences { mode: DataMode; theme: 'dark' | 'light'; retentionDays: 7 | 30 | 90; reduceMotion: boolean; onboardingComplete: boolean; noticesEnabled: boolean; technicalDetails: boolean }
export const DEFAULT_PREFERENCES: PrivacyPreferences = { mode: 'demo', theme: 'dark', retentionDays: 30, reduceMotion: false, onboardingComplete: false, noticesEnabled: true, technicalDetails: false };
const KEYS = { preferences: 'ipward:preferences:v1', captures: 'ipward:captures:v1' };
const MAX_CAPTURES = 50;

/** The adapter makes persistence replaceable by SQLite for production-sized event history. */
export function createLocalStore(adapter: KeyValueStorage) {
  const readJSON = async (key: string): Promise<unknown> => {
    const raw = await adapter.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };
  const store = {
    async loadPreferences(): Promise<PrivacyPreferences> {
      const data = await readJSON(KEYS.preferences);
      if (!data || typeof data !== 'object') return { ...DEFAULT_PREFERENCES };
      const p = data as Partial<PrivacyPreferences>;
      return { mode: p.mode === 'device' ? 'device' : 'demo', theme: p.theme === 'light' ? 'light' : 'dark', retentionDays: p.retentionDays === 7 || p.retentionDays === 90 ? p.retentionDays : 30, reduceMotion: p.reduceMotion === true, onboardingComplete: p.onboardingComplete === true, noticesEnabled: p.noticesEnabled !== false, technicalDetails: p.technicalDetails === true };
    },
    async savePreferences(preferences: PrivacyPreferences): Promise<void> { await adapter.setItem(KEYS.preferences, JSON.stringify(preferences)); },
    async loadCaptures(now = Date.now(), retentionDays = 30): Promise<CaptureSession[]> {
      const data = await readJSON(KEYS.captures);
      if (!Array.isArray(data)) return [];
      const captures = data.filter(isStoredCapture).filter(capture => capture.endedAt !== null && capture.endedAt >= now - retentionDays * 86400000).slice(0, MAX_CAPTURES).map(capture => ({ ...capture, summary: summarizeConnections(capture.connections) }));
      if (captures.length !== data.length) await adapter.setItem(KEYS.captures, JSON.stringify(captures));
      return captures;
    },
    async saveCaptures(captures: readonly CaptureSession[]): Promise<void> { await adapter.setItem(KEYS.captures, JSON.stringify(captures.filter(isStoredCapture).slice(0, MAX_CAPTURES))); },
    async deleteCaptures(): Promise<void> { await adapter.removeItem(KEYS.captures); },
    async deleteAllLocalData(): Promise<void> { await adapter.removeItem(KEYS.captures); await adapter.removeItem(KEYS.preferences); },
  };
  return store;
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const sources = ['demo', 'network-extension', 'vpn-service', 'device-activity', 'notification-listener', 'authorized-integration', 'user-import'];
const categories = ['App service', 'CDN', 'Authentication', 'Cloud', 'Analytics', 'Advertising', 'Attribution', 'Marketing', 'Telemetry', 'Crash reporting', 'Communication', 'Unknown'];
const sourceValid = (value: unknown) => typeof value === 'string' && sources.includes(value);
const foregroundValid = (value: unknown) => ['foreground', 'background', 'unknown'].includes(String(value));
export function isStoredAdSighting(value: unknown): value is AdSighting {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 100
    && nonnegative(value.observedAt) && value.observedAt <= Date.now() + 86_400_000
    && typeof value.appName === 'string' && value.appName.trim().length > 0 && value.appName.length <= 80
    && typeof value.wording === 'string' && value.wording.trim().length > 0 && value.wording.length <= 280
    && (value.recalledOrigin === undefined || ['spoken', 'browser-typing', 'other', 'unsure'].includes(String(value.recalledOrigin)))
    && (value.topics === undefined || Array.isArray(value.topics) && value.topics.length <= 10 && value.topics.every(topic => typeof topic === 'string' && topic.trim().length > 0 && topic.length <= 40))
    && value.source === 'user-note';
}
export function isStoredNewDomainNotice(value: unknown): value is NewDomainNotice {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 512
    && (value.appId === null || typeof value.appId === 'string')
    && typeof value.appName === 'string' && value.appName.length <= 160
    && typeof value.domain === 'string' && value.domain.length > 0 && value.domain.length <= 253
    && (value.organizationName === null || typeof value.organizationName === 'string' && value.organizationName.length <= 200)
    && typeof value.organizationHint === 'boolean' && typeof value.potentialTracker === 'boolean' && nonnegative(value.firstSeenAt) && value.firstSeenAt <= Date.now() + 86_400_000
    && value.source === 'user-import';
}
function isProvenance(value: unknown): value is Provenance {
  return isRecord(value) && ['Confirmed', 'Observed', 'Estimated', 'Unavailable'].includes(String(value.state)) && sourceValid(value.source) && ['high', 'medium', 'low'].includes(String(value.confidence)) && typeof value.explanation === 'string';
}
function isConnection(value: unknown): value is ConnectionEvent {
  if (!isRecord(value) || !isRecord(value.classification)) return false;
  const classification = value.classification;
  return ['id', 'domain', 'ip', 'country', 'countryCode', 'region', 'asn'].every(key => typeof value[key] === 'string') && nonnegative(value.timestamp) && (value.appId === null || typeof value.appId === 'string') && (value.organizationId === null || typeof value.organizationId === 'string') && nonnegative(value.port) && value.port <= 65535 && ['TLS', 'QUIC', 'HTTPS', 'Unknown'].includes(String(value.protocol)) && nonnegative(value.bytesUploaded) && nonnegative(value.bytesDownloaded) && (value.bytesMeasured === undefined || typeof value.bytesMeasured === 'boolean') && (value.reportHits === undefined || nonnegative(value.reportHits)) && (value.reportFirstAt === undefined || nonnegative(value.reportFirstAt) && value.reportFirstAt <= value.timestamp) && foregroundValid(value.foregroundState) && categories.includes(String(value.category)) && typeof value.isNewDestination === 'boolean' && sourceValid(value.source) && isProvenance(value.provenance) && typeof classification.domain === 'string' && (classification.organizationId === null || typeof classification.organizationId === 'string') && Array.isArray(classification.categories) && classification.categories.every(category => categories.includes(category)) && ['high', 'medium', 'low'].includes(String(classification.confidence)) && ['bundled-demo-rules', 'bundled-provider-hints', 'unknown'].includes(String(classification.source)) && typeof classification.lastUpdated === 'string' && typeof classification.explanation === 'string';
}
function isSensor(value: unknown): value is SensorEvent {
  return isRecord(value) && typeof value.id === 'string' && nonnegative(value.timestamp) && nonnegative(value.timestampEnd) && value.timestampEnd >= value.timestamp && (value.appId === null || typeof value.appId === 'string') && ['Microphone', 'Camera', 'Location', 'Photos', 'Contacts', 'Bluetooth', 'Calendar'].includes(String(value.sensor)) && foregroundValid(value.foregroundState) && sourceValid(value.source) && isProvenance(value.provenance);
}
export function isStoredCapture(value: unknown): value is CaptureSession {
  if (!value || typeof value !== 'object') return false;
  const capture = value as Partial<CaptureSession>;
  return capture.schemaVersion === 1 && (capture.kind === undefined || ['demo', 'report-snapshot', 'live'].includes(capture.kind)) && typeof capture.id === 'string' && typeof capture.name === 'string' && typeof capture.notes === 'string' && (capture.appId === null || typeof capture.appId === 'string') && (capture.mode === 'demo' || capture.mode === 'device') && capture.status === 'saved' && nonnegative(capture.startedAt) && nonnegative(capture.endedAt) && capture.endedAt >= capture.startedAt && Array.isArray(capture.connections) && capture.connections.every(event => isConnection(event) && ((event.source === 'demo') === (capture.mode === 'demo')) && event.provenance.source === event.source && (capture.kind !== 'report-snapshot' || event.source === 'user-import')) && Array.isArray(capture.sensors) && capture.sensors.every(event => isSensor(event) && ((event.source === 'demo') === (capture.mode === 'demo')) && event.provenance.source === event.source && (capture.kind !== 'report-snapshot' || event.source === 'user-import')) && isRecord(capture.summary) && ['connections', 'uploaded', 'downloaded', 'background', 'organizations', 'apps', 'countries', 'marketing', 'analytics', 'unknown', 'newDestinations', 'domains'].every(key => nonnegative((capture.summary as unknown as Record<string, unknown>)[key]));
}

export function createMemoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return { async getItem(key) { return values.get(key) ?? null; }, async setItem(key, value) { values.set(key, value); }, async removeItem(key) { values.delete(key); } };
}
