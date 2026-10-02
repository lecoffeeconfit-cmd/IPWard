import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class IpwardUsageModule extends NativeModule<{}> {
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): void;
  queryDailyUsage(startMillis: number, endMillis: number): Promise<{ packageName: string; label: string; bucketStart: number; bucketEnd: number; foregroundMs: number; lastTimeUsed: number }[]>;
}

export default requireOptionalNativeModule<IpwardUsageModule>('IpwardUsage');
