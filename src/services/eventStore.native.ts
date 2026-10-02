import * as SQLite from 'expo-sqlite';
import { AppProfile, ConnectionEvent, Organization, PrivacyDataset, SensorEvent } from '../types';
import { emptyImportedDataset, ImportedEventStore } from './eventStore.types';

let database: Promise<SQLite.SQLiteDatabase> | null = null;
async function open() {
  if (!database) database = (async () => {
    const db = await SQLite.openDatabaseAsync('ipward-evidence-v1.db');
    await db.execAsync(`PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, kind TEXT NOT NULL, timestamp INTEGER NOT NULL, app_id TEXT, organization_id TEXT, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS events_time ON events(timestamp DESC);
      CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, kind TEXT NOT NULL, json TEXT NOT NULL);
      PRAGMA user_version = 1;`);
    return db;
  })().catch(error => { database = null; throw error; });
  return database;
}
type EventRow = { json: string };
const parseRows = <T>(rows: EventRow[]): T[] => rows.flatMap(row => { try { return [JSON.parse(row.json) as T]; } catch { return []; } });
async function load(retentionDays: number): Promise<PrivacyDataset> {
  const db = await open();
  const cutoff = retentionDays === 0 ? 0 : Date.now() - retentionDays * 86_400_000;
  await db.runAsync('DELETE FROM events WHERE timestamp < ?', cutoff);
  const [connectionRows, sensorRows, appRows, organizationRows] = await Promise.all([
    db.getAllAsync<EventRow>("SELECT json FROM events WHERE kind = 'connection' ORDER BY timestamp DESC LIMIT 50000"),
    db.getAllAsync<EventRow>("SELECT json FROM events WHERE kind = 'sensor' ORDER BY timestamp DESC LIMIT 50000"),
    db.getAllAsync<EventRow>("SELECT json FROM profiles WHERE kind = 'app'"),
    db.getAllAsync<EventRow>("SELECT json FROM profiles WHERE kind = 'organization'"),
  ]);
  const connections = parseRows<ConnectionEvent>(connectionRows);
  const sensors = parseRows<SensorEvent>(sensorRows);
  const appIds = new Set([...connections.map(e => e.appId), ...sensors.map(e => e.appId)]);
  const organizationIds = new Set(connections.map(e => e.organizationId));
  return { ...emptyImportedDataset(), connections, sensors, apps: parseRows<AppProfile>(appRows).filter(a => appIds.has(a.id)), organizations: parseRows<Organization>(organizationRows).filter(o => organizationIds.has(o.id)) };
}
export const importedEventStore: ImportedEventStore = {
  load,
  async merge(dataset, retentionDays) {
    if (dataset.mode !== 'device' || dataset.connections.some(e => e.source !== 'user-import') || dataset.sensors.some(e => e.source !== 'user-import')) throw new Error('Only normalized user-import events may be stored here.');
    const db = await open();
    const cutoff = retentionDays === 0 ? 0 : Date.now() - retentionDays * 86_400_000;
    await db.withExclusiveTransactionAsync(async tx => {
      const profile = await tx.prepareAsync('INSERT OR REPLACE INTO profiles (id, kind, json) VALUES (?, ?, ?)');
      const event = await tx.prepareAsync('INSERT INTO events (id, kind, timestamp, app_id, organization_id, json) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET timestamp=excluded.timestamp, app_id=excluded.app_id, organization_id=excluded.organization_id, json=excluded.json WHERE excluded.timestamp >= events.timestamp');
      try {
        for (const item of dataset.apps) await profile.executeAsync([item.id, 'app', JSON.stringify(item)]);
        for (const item of dataset.organizations) await profile.executeAsync([item.id, 'organization', JSON.stringify(item)]);
        for (const item of dataset.connections) if (item.timestamp >= cutoff) await event.executeAsync([item.id, 'connection', item.timestamp, item.appId, item.organizationId, JSON.stringify(item)]);
        for (const item of dataset.sensors) if (item.timestamp >= cutoff) await event.executeAsync([item.id, 'sensor', item.timestamp, item.appId, null, JSON.stringify(item)]);
      } finally { await profile.finalizeAsync(); await event.finalizeAsync(); }
      await tx.runAsync('DELETE FROM events WHERE timestamp < ?', cutoff);
    });
    return load(retentionDays);
  },
  async clear() {
    const db = await open();
    await db.withExclusiveTransactionAsync(async tx => { await tx.execAsync('DELETE FROM events; DELETE FROM profiles;'); });
  },
};
