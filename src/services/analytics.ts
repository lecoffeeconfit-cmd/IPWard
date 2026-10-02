import { ConnectionCategory, ConnectionEvent, ConnectionSummary, DateInterval, PrivacyDataset, SensorType, TimeRange } from '../types';
import { isMarketingCategory } from './classifier';

export interface ConnectionFilters { range?: TimeRange; appId?: string; category?: ConnectionCategory | 'All' | 'Marketing'; backgroundOnly?: boolean; search?: string; country?: string; organizationId?: string; newOnly?: boolean; minUpload?: number }

/** Closed interval, capped at now. Calendar boundaries follow the device timezone. */
export function getRangeInterval(range: TimeRange, now = Date.now()): DateInterval {
  if (range === 'Live') return { start: now - 60 * 60 * 1000, end: now };
  const date = new Date(now); date.setHours(0, 0, 0, 0);
  if (range === 'Yesterday') { const end = date.getTime() - 1; date.setDate(date.getDate() - 1); return { start: date.getTime(), end }; }
  if (range === '7 days') date.setDate(date.getDate() - 6);
  if (range === '30 days') date.setDate(date.getDate() - 29);
  return { start: date.getTime(), end: now };
}

export function filterByRange<T extends { timestamp: number }>(events: readonly T[], range: TimeRange, now = Date.now()): T[] {
  const { start, end } = getRangeInterval(range, now);
  return events.filter(event => event.timestamp >= start && event.timestamp <= end);
}

export function filterConnections(dataset: PrivacyDataset, filters: ConnectionFilters = {}, now = Date.now()): ConnectionEvent[] {
  const search = filters.search?.trim().toLowerCase();
  return filterByRange(dataset.connections, filters.range ?? 'Today', now).filter(event => {
    const app = dataset.apps.find(item => item.id === event.appId);
    const org = dataset.organizations.find(item => item.id === event.organizationId);
    return (!filters.appId || event.appId === filters.appId)
      && (!filters.category || filters.category === 'All' || (filters.category === 'Marketing' ? isMarketingCategory(event.category) : event.category === filters.category))
      && (!filters.backgroundOnly || event.foregroundState === 'background')
      && (!filters.country || event.country === filters.country || event.countryCode === filters.country)
      && (!filters.organizationId || event.organizationId === filters.organizationId)
      && (!filters.newOnly || event.isNewDestination)
      && (filters.minUpload === undefined || event.bytesUploaded >= filters.minUpload)
      && (!search || [event.domain, event.ip, app?.name, org?.name, event.country, event.category].join(' ').toLowerCase().includes(search));
  }).sort((a, b) => b.timestamp - a.timestamp);
}

export function summarizeConnections(events: readonly ConnectionEvent[]): ConnectionSummary {
  return { connections: events.length, uploaded: events.reduce((sum, event) => sum + event.bytesUploaded, 0), downloaded: events.reduce((sum, event) => sum + event.bytesDownloaded, 0), measuredTransfers: events.filter(event => event.bytesMeasured !== false).length, background: events.filter(event => event.foregroundState === 'background').length, organizations: new Set(events.map(event => event.organizationId).filter(Boolean)).size, apps: new Set(events.map(event => event.appId).filter(Boolean)).size, countries: new Set(events.map(event => event.countryCode).filter(Boolean)).size, marketing: events.filter(event => isMarketingCategory(event.category)).length, analytics: events.filter(event => event.category === 'Analytics').length, unknown: events.filter(event => event.category === 'Unknown').length, newDestinations: new Set(events.filter(event => event.isNewDestination).map(event => event.domain)).size, domains: new Set(events.map(event => event.domain)).size };
}

export const formatEventBytes = (event: ConnectionEvent, direction: 'up' | 'down') => event.bytesMeasured === false ? 'Unavailable' : formatBytes(direction === 'up' ? event.bytesUploaded : event.bytesDownloaded);
export const formatSummaryBytes = (summary: ConnectionSummary, direction: 'up' | 'down') => summary.connections > 0 && summary.measuredTransfers === 0 ? 'Unavailable' : formatBytes(direction === 'up' ? summary.uploaded : summary.downloaded);

export function getCommunicationSummary(dataset: PrivacyDataset, range: TimeRange = 'Today', now = Date.now()) {
  const events = filterByRange(dataset.communications, range, now);
  const sum = (type: 'call' | 'email' | 'notification' | 'app-usage', direction?: 'incoming' | 'outgoing') => events.filter(event => event.type === type && (!direction || event.direction === direction)).reduce((total, event) => total + event.count, 0);
  return { events, calls: sum('call'), callDurationSeconds: events.filter(event => event.type === 'call').reduce((total, event) => total + event.durationSeconds, 0), emailsReceived: sum('email', 'incoming'), emailsSent: sum('email', 'outgoing'), communicationNotifications: sum('notification'), communicationUsageSeconds: events.filter(event => event.type === 'app-usage').reduce((total, event) => total + event.durationSeconds, 0), communicationApps: new Set(events.map(event => event.appId)).size, messageEstimate: { value: null, state: 'Unavailable' as const, explanation: 'Exact messages are not exposed. Notifications, time in an app, and network transfers cannot establish message counts.' } };
}

export function getOverview(dataset: PrivacyDataset, range: TimeRange = 'Today', now = Date.now()) {
  const connections = filterConnections(dataset, { range }, now);
  const sensors = filterByRange(dataset.sensors, range, now);
  const sensorCounts: Record<SensorType, number> = { Microphone: 0, Camera: 0, Location: 0, Photos: 0, Contacts: 0, Bluetooth: 0, Calendar: 0 };
  sensors.forEach(event => { sensorCounts[event.sensor] += 1; });
  return { ...summarizeConnections(connections), sensorCounts, sensorApps: new Set(sensors.map(event => event.appId).filter(Boolean)).size, sensors, ...getCommunicationSummary(dataset, range, now), alerts: filterByRange(dataset.alerts, range, now) };
}

export function getAppStats(dataset: PrivacyDataset, appId: string, range: TimeRange = 'Today', now = Date.now()) {
  const connections = filterConnections(dataset, { range, appId }, now);
  return { ...summarizeConnections(connections), app: dataset.apps.find(app => app.id === appId), connectionEvents: connections, sensorEvents: filterByRange(dataset.sensors, range, now).filter(event => event.appId === appId), organizationProfiles: dataset.organizations.filter(org => connections.some(event => event.organizationId === org.id)), communicationEvents: filterByRange(dataset.communications, range, now).filter(event => event.appId === appId) };
}

export function getHourlyTraffic(events: readonly ConnectionEvent[], range: TimeRange = 'Today', now = Date.now()): { label: string; hour: number; uploaded: number; downloaded: number; connections: number }[] {
  const selected = filterByRange(events, range, now);
  return Array.from({ length: 24 }, (_, hour) => {
    const inHour = selected.filter(event => new Date(event.timestamp).getHours() === hour);
    const summary = summarizeConnections(inHour);
    return { label: `${hour.toString().padStart(2, '0')}:00`, hour, uploaded: summary.uploaded, downloaded: summary.downloaded, connections: summary.connections };
  });
}

export function groupConnectionsByOrganization(dataset: PrivacyDataset, events: readonly ConnectionEvent[]) {
  return [...new Set(events.map(event => event.organizationId))].map(id => ({ organization: dataset.organizations.find(org => org.id === id) ?? { id: 'unknown', name: 'Unknown organization', initials: '?', color: '#94A3B8', description: 'No confident match. Unknown does not mean unsafe.' }, ...summarizeConnections(events.filter(event => event.organizationId === id)) })).sort((a, b) => b.connections - a.connections);
}

export function groupConnectionsByCountry(events: readonly ConnectionEvent[]) {
  return [...new Set(events.map(event => event.countryCode))].map(code => { const selected = events.filter(event => event.countryCode === code); return { code, country: selected[0].country, ...summarizeConnections(selected) }; }).sort((a, b) => b.connections - a.connections);
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1);
  return `${Number((bytes / 1000 ** index).toFixed(index === 0 ? 0 : decimals))} ${units[index]}`;
}
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total >= 3600) return `${Math.floor(total / 3600)}h ${Math.floor(total % 3600 / 60)}m`;
  if (total >= 60) return `${Math.floor(total / 60)}m ${total % 60}s`;
  return `${total}s`;
}
export function formatTime(timestamp: number): string { return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
export function timeAgo(timestamp: number, now = Date.now()): string { const minutes = Math.max(0, Math.floor((now - timestamp) / 60000)); return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`; }
