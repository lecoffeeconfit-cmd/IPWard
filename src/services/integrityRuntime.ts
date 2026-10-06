import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import { File, Paths } from 'expo-file-system';
import { EnvironmentSnapshot, IntegritySession, waitForForeground } from './integrityScan';
import { runPerformanceProbe } from './performanceProbe';

export async function captureIntegrityEnvironment(): Promise<EnvironmentSnapshot> {
  if (Platform.OS === 'web') return {
    at: Date.now(), platform: 'web', model: null, osVersion: null, appVersion: null,
    batteryPercent: null, charging: null, lowPowerMode: null, networkType: null, internetReachable: null,
    thermalState: 'unavailable', bluetoothState: 'unavailable', uptimeSeconds: null,
  };
  const [power, network] = await Promise.allSettled([Battery.getPowerStateAsync(), Network.getNetworkStateAsync()]);
  const battery = power.status === 'fulfilled' ? power.value : null;
  const link = network.status === 'fulfilled' ? network.value : null;
  return {
    at: Date.now(), platform: Platform.OS, model: Device.modelName ?? null, osVersion: Device.osVersion ?? null,
    appVersion: Application.nativeApplicationVersion ?? null,
    batteryPercent: battery && battery.batteryLevel >= 0 ? Math.round(battery.batteryLevel * 100) : null,
    charging: battery && battery.batteryState !== Battery.BatteryState.UNKNOWN ? battery.batteryState === Battery.BatteryState.CHARGING || battery.batteryState === Battery.BatteryState.FULL : null,
    lowPowerMode: battery?.lowPowerMode ?? null,
    networkType: link ? String(link.type) : null, internetReachable: link?.isInternetReachable ?? null,
    thermalState: 'unavailable', bluetoothState: 'unavailable', uptimeSeconds: null,
  };
}

async function measureAppFileAccess(): Promise<number> {
  const filename = `integrity-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
  const file = new File(Paths.cache, filename);
  const payload = 'IPWARD-LOCAL-PROBE-'.repeat(4096);
  const start = performance.now();
  try {
    file.create({ overwrite: false });
    file.write(payload);
    const returned = await file.text();
    if (returned !== payload) throw new Error('The app file check returned different content.');
    return Math.round((performance.now() - start) * 10) / 10;
  } finally { try { file.delete(); } catch { /* Cache cleanup is best effort. */ } }
}

export interface QuickProgress { stage: string; fraction: number; elapsedMs: number }
export interface QuickResult { environment: EnvironmentSnapshot; snapshots: EnvironmentSnapshot[]; performance: IntegritySession['performance']; coverage: string[]; limitations: string[]; fileAccessMs: number | null; networkLatencyMs: number | null }

/** Foreground-only experiment; samples this app, never other processes or hidden system services. */
export async function runQuickIntegrity(
  controlled: boolean, development: boolean, networkConsent: boolean,
  signal: AbortSignal, isActive: () => boolean, onProgress: (progress: QuickProgress) => void,
  onCheckpoint?: (partial: QuickResult) => void,
): Promise<QuickResult> {
  const started = Date.now();
  const emit = (stage: string, fraction: number) => onProgress({ stage, fraction, elapsedMs: Date.now() - started });
  if (signal.aborted || !isActive()) throw new Error('Keep IPward open to start the scan.');
  emit('Recording device conditions', 0.01);
  const environment = await captureIntegrityEnvironment();
  const snapshots = [environment];
  const limitations: string[] = [];
  const coverage = ['Device, battery, power mode and connection type when supported'];
  if (environment.batteryPercent === null) limitations.push('Battery information was unavailable.');
  if (environment.networkType === null) limitations.push('Connection type was unavailable.');
  if (environment.lowPowerMode) limitations.push('Low Power Mode may affect timing.');
  const comparableConditions = controlled && Platform.OS !== 'web' && environment.lowPowerMode === false
    && environment.batteryPercent !== null && environment.batteryPercent >= 20;
  if (controlled && !comparableConditions) limitations.push('Conditions could not be verified for a personal timing baseline; these runs are reference only.');
  const performanceRuns: IntegritySession['performance'] = [];
  const checkpoint = () => onCheckpoint?.({ environment, snapshots: [...snapshots], performance: [...performanceRuns], coverage: [...coverage], limitations: [...limitations], fileAccessMs, networkLatencyMs });
  let fileAccessMs: number | null = null;
  let networkLatencyMs: number | null = null;
  checkpoint();
  await waitForForeground(20_000, signal, isActive, elapsed => emit('Stabilizing', 0.03 + elapsed / 20_000 * 0.04));
  await waitForForeground(60_000, signal, isActive, elapsed => emit('Quiet observation', 0.07 + elapsed / 60_000 * 0.10));

  try { fileAccessMs = await measureAppFileAccess(); coverage.push('Read and write of a temporary file owned by IPward'); }
  catch { limitations.push('The temporary app file check was unavailable.'); }

  if (networkConsent) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const before = performance.now();
      const response = await fetch('https://speed.cloudflare.com/__down?bytes=0', { signal: controller.signal, cache: 'no-store' });
      await response.arrayBuffer();
      if (response.ok) { networkLatencyMs = Math.round((performance.now() - before) * 10) / 10; coverage.push('One opt-in HTTPS response from Cloudflare, with no test payload'); }
      else limitations.push('The optional internet response check did not return a successful status.');
    } catch { limitations.push('The optional internet response check did not finish.'); }
    finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
  } else limitations.push('Optional internet response check was skipped.');

  checkpoint();
  for (let index = 0; index < 7; index++) {
    if (signal.aborted || !isActive()) throw new Error('Scan interrupted. Keep IPward open in the foreground.');
    emit(`Timing sample ${index + 1} of 7`, 0.17 + index / 7 * 0.82);
    try { performanceRuns.push(await runPerformanceProbe(Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web', development, comparableConditions, () => !signal.aborted && isActive())); }
    catch (error) {
      if (signal.aborted || !isActive()) throw error;
      limitations.push(`Timing sample ${index + 1} was unavailable.`);
    }
    snapshots.push(await captureIntegrityEnvironment());
    checkpoint();
    if (index < 6) await waitForForeground(70_000, signal, isActive, elapsed => emit(`Quiet interval ${index + 1} of 6`, 0.17 + (index + elapsed / 70_000) / 7 * 0.82));
  }
  emit('Analyzing available evidence', 1);
  coverage.push(`${performanceRuns.length} of 7 scheduled IPward timing samples completed`);
  if (performanceRuns.length < 3) limitations.push('Too few timing samples for a useful comparison.');
  limitations.push('This scan uses JavaScript timing within IPward. It has no native process attribution, radio scan or system forensic access.');
  return { environment, snapshots, performance: performanceRuns, coverage, limitations, fileAccessMs, networkLatencyMs };
}
