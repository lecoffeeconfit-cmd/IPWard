import { Platform } from 'react-native';
import IpwardUsageModule from '../../modules/ipward-usage/src/IpwardUsageModule';
import { AppProfile, AppUsageRecord } from '../types';
import { normalizeAndroidUsage } from './androidUsageCore';

export type UsageAccess = 'unsupported' | 'denied' | 'authorized';
export interface UsageSnapshot { access: UsageAccess; apps: AppProfile[]; records: AppUsageRecord[] }

export async function readAndroidUsage(): Promise<UsageSnapshot> {
  if (Platform.OS !== 'android' || !IpwardUsageModule) return { access: 'unsupported', apps: [], records: [] };
  if (!IpwardUsageModule.hasUsageAccess()) return { access: 'denied', apps: [], records: [] };
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 29);
  const rows = await IpwardUsageModule.queryDailyUsage(start.getTime(), Date.now());
  return { access: 'authorized', ...normalizeAndroidUsage(rows, start.getTime(), Date.now()) };
}

export function openAndroidUsageSettings(): boolean {
  if (Platform.OS !== 'android' || !IpwardUsageModule) return false;
  IpwardUsageModule.openUsageAccessSettings();
  return true;
}
