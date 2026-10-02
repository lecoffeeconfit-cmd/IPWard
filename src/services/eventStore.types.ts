import { PrivacyDataset } from '../types';
export interface ImportedEventStore {
  load(retentionDays: number): Promise<PrivacyDataset>;
  merge(dataset: PrivacyDataset, retentionDays: number): Promise<PrivacyDataset>;
  clear(): Promise<void>;
}
export const emptyImportedDataset = (): PrivacyDataset => ({ mode: 'device', generatedAt: Date.now(), apps: [], organizations: [], connections: [], sensors: [], communications: [], alerts: [] });
export function mergeImportedDatasets(current: PrivacyDataset, incoming: PrivacyDataset, retentionDays: number): PrivacyDataset {
  const cutoff = retentionDays === 0 ? 0 : Date.now() - retentionDays * 86_400_000;
  const merge = <T extends { id: string }>(a: T[], b: T[]) => [...new Map([...a, ...b].map(item => [item.id, item])).values()];
  const byLatest = new Map(current.connections.map(event => [event.id, event]));
  incoming.connections.forEach(event => { if (!byLatest.has(event.id) || event.timestamp >= byLatest.get(event.id)!.timestamp) byLatest.set(event.id, event); });
  const connections = [...byLatest.values()].filter(e => e.timestamp >= cutoff).sort((a, b) => b.timestamp - a.timestamp).slice(0, 50_000);
  const sensors = merge(current.sensors, incoming.sensors).filter(e => e.timestamp >= cutoff).sort((a, b) => b.timestamp - a.timestamp).slice(0, 50_000);
  const appIds = new Set([...connections.map(e => e.appId), ...sensors.map(e => e.appId)]);
  const organizationIds = new Set(connections.map(e => e.organizationId));
  return { mode: 'device', generatedAt: Date.now(), apps: merge(current.apps, incoming.apps).filter(a => appIds.has(a.id)), organizations: merge(current.organizations, incoming.organizations).filter(o => organizationIds.has(o.id)), connections, sensors, communications: [], alerts: [] };
}
