import { AppProfile, AppUsageRecord } from '../types';

export interface AndroidUsageRow {
  packageName: string;
  label: string;
  bucketStart: number;
  bucketEnd: number;
  foregroundMs: number;
  lastTimeUsed: number;
}

/** Converts OS daily buckets to local, source-labelled records. */
export function normalizeAndroidUsage(rows: AndroidUsageRow[], earliestDay: number, now: number): { apps: AppProfile[]; records: AppUsageRecord[] } {
  const apps = new Map<string, AppProfile>();
  const records = new Map<string, AppUsageRecord>();
  for (const row of rows) {
    if (!row || typeof row.packageName !== 'string' || !/^[a-zA-Z0-9_.]+$/.test(row.packageName) || !Number.isFinite(row.bucketStart) || !Number.isFinite(row.foregroundMs) || row.foregroundMs <= 0 || row.foregroundMs > 86_400_000) continue;
    const day = new Date(row.bucketStart); day.setHours(0, 0, 0, 0);
    const dayStart = day.getTime();
    if (dayStart < earliestDay || dayStart > now) continue;
    const appId = `android:${row.packageName}`;
    const name = typeof row.label === 'string' && row.label.trim() ? row.label.trim().slice(0, 80) : row.packageName;
    if (!apps.has(appId)) apps.set(appId, { id: appId, identifier: row.packageName, name, initials: name.slice(0, 2).toUpperCase(), color: '#75C1AD', icon: 'smartphone', category: 'Android app', permissions: [], source: 'device-activity' });
    const id = `android-usage:${row.packageName}:${dayStart}`;
    const previous = records.get(id);
    records.set(id, { id, appId, dayStart, durationSeconds: Math.min(86_400, (previous?.durationSeconds ?? 0) + Math.round(row.foregroundMs / 1000)), lastTimeUsed: Math.max(previous?.lastTimeUsed ?? 0, Number.isFinite(row.lastTimeUsed) ? row.lastTimeUsed : 0), source: 'device-activity', provenance: { state: 'Confirmed', source: 'device-activity', confidence: 'high', explanation: 'Daily foreground-time aggregate returned by Android UsageStatsManager after the user granted Usage Access. It is not a message count or proof of what happened inside the app.' } });
  }
  return { apps: [...apps.values()], records: [...records.values()].sort((a, b) => b.dayStart - a.dayStart) };
}
