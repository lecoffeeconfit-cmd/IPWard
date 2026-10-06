import { PerformanceRun, comparePerformanceRun, isStoredPerformanceRun } from './performanceProbe';
import { SecurityReview } from './securityScan';
import { SecurityIndicatorSet } from './securityIndicators';

export type IntegrityKind = 'quick' | 'extended' | 'deep';
export type IntegrityStatus = 'running' | 'completed' | 'interrupted';
export type ThreatNotice = 'yes' | 'no' | 'unsure';
export type EvidenceStrength = 'strong-lead' | 'review' | 'context';

export interface IntegrityEvidence {
  id: string;
  category: 'forensic' | 'indicator' | 'behavior' | 'timing' | 'context';
  title: string;
  detail: string;
  source: string;
  timestamp: number;
  strength: EvidenceStrength;
  corroboration: string;
}

export interface EnvironmentSnapshot {
  at: number;
  platform: string;
  model: string | null;
  osVersion: string | null;
  appVersion: string | null;
  batteryPercent: number | null;
  charging: boolean | null;
  lowPowerMode: boolean | null;
  networkType: string | null;
  internetReachable: boolean | null;
  thermalState: 'unavailable';
  bluetoothState: 'unavailable';
  uptimeSeconds: null;
}

export interface IntegritySession {
  version: 1;
  id: string;
  kind: IntegrityKind;
  status: IntegrityStatus;
  startedAt: number;
  updatedAt: number;
  endsAt: number | null;
  notice: ThreatNotice;
  controlled: boolean;
  environment: EnvironmentSnapshot | null;
  snapshots: EnvironmentSnapshot[];
  performance: PerformanceRun[];
  evidence: IntegrityEvidence[];
  coverage: string[];
  limitations: string[];
  importedReportName?: string;
}

export const COMMON_LIMITATIONS = [
  'A normal result cannot rule out Pegasus or other spyware.',
  'This app cannot inspect other apps, processes, iOS system logs, thermal state, Bluetooth discovery, or a full device backup.',
  'Timing and battery changes have many ordinary causes and cannot identify spyware.',
];

/** Abortable foreground delay shared by scan phases; elapsed time is wall-clock time, not a sample. */
export async function waitForForeground(ms: number, signal: AbortSignal, isActive: () => boolean, tick?: (elapsed: number) => void): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < ms) {
    if (signal.aborted || !isActive()) throw new Error('Scan interrupted. Keep IPward open in the foreground.');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { signal.removeEventListener('abort', stopped); resolve(); }, Math.min(1000, ms - (Date.now() - started)));
      const stopped = () => { clearTimeout(timer); signal.removeEventListener('abort', stopped); reject(new Error('Scan cancelled.')); };
      signal.addEventListener('abort', stopped, { once: true });
    });
    tick?.(Math.min(ms, Date.now() - started));
  }
}

export function newIntegritySession(kind: IntegrityKind, notice: ThreatNotice, controlled: boolean, hours?: 1 | 6 | 24, now = Date.now()): IntegritySession {
  return { version: 1, id: `${now}-${Math.random().toString(36).slice(2, 8)}`, kind, status: 'running', startedAt: now, updatedAt: now,
    endsAt: kind === 'extended' ? now + (hours ?? 24) * 3_600_000 : null, notice, controlled, environment: null,
    snapshots: [], performance: [], evidence: [], coverage: [], limitations: [...COMMON_LIMITATIONS] };
}

export function isIntegritySession(value: unknown): value is IntegritySession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as Partial<IntegritySession>;
  return s.version === 1 && typeof s.id === 'string' && /^\d+-[a-z0-9]{1,12}$/.test(s.id)
    && (s.kind === 'quick' || s.kind === 'extended' || s.kind === 'deep')
    && (s.status === 'running' || s.status === 'completed' || s.status === 'interrupted')
    && typeof s.startedAt === 'number' && Number.isFinite(s.startedAt) && s.startedAt > 0
    && typeof s.updatedAt === 'number' && Number.isFinite(s.updatedAt) && s.updatedAt >= s.startedAt
    && (s.endsAt === null || (typeof s.endsAt === 'number' && Number.isFinite(s.endsAt) && s.endsAt > s.startedAt))
    && (s.notice === 'yes' || s.notice === 'no' || s.notice === 'unsure') && typeof s.controlled === 'boolean'
    && (s.environment === null || isEnvironmentSnapshot(s.environment))
    && Array.isArray(s.snapshots) && s.snapshots.length <= 512 && s.snapshots.every(isEnvironmentSnapshot)
    && Array.isArray(s.performance) && s.performance.length <= 32 && s.performance.every(isStoredPerformanceRun)
    && Array.isArray(s.evidence) && s.evidence.length <= 1200 && s.evidence.every(isIntegrityEvidence)
    && Array.isArray(s.coverage) && s.coverage.length <= 100 && s.coverage.every(line => typeof line === 'string' && line.length <= 500)
    && Array.isArray(s.limitations) && s.limitations.length <= 150 && s.limitations.every(line => typeof line === 'string' && line.length <= 500)
    && (s.importedReportName === undefined || (typeof s.importedReportName === 'string' && s.importedReportName.length <= 200));
}

function isEnvironmentSnapshot(value: unknown): value is EnvironmentSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Partial<EnvironmentSnapshot>;
  return typeof snapshot.at === 'number' && Number.isFinite(snapshot.at) && snapshot.at > 0 && snapshot.at <= Date.now() + 86_400_000
    && typeof snapshot.platform === 'string' && snapshot.platform.length <= 30
    && (['model', 'osVersion', 'appVersion', 'networkType'] as const).every(key => snapshot[key] === null || (typeof snapshot[key] === 'string' && snapshot[key]!.length <= 120))
    && (snapshot.batteryPercent === null || (typeof snapshot.batteryPercent === 'number' && Number.isInteger(snapshot.batteryPercent) && snapshot.batteryPercent >= 0 && snapshot.batteryPercent <= 100))
    && (snapshot.charging === null || typeof snapshot.charging === 'boolean')
    && (snapshot.lowPowerMode === null || typeof snapshot.lowPowerMode === 'boolean')
    && (snapshot.internetReachable === null || typeof snapshot.internetReachable === 'boolean')
    && snapshot.thermalState === 'unavailable' && snapshot.bluetoothState === 'unavailable' && snapshot.uptimeSeconds === null;
}

function isIntegrityEvidence(value: unknown): value is IntegrityEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<IntegrityEvidence>;
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 150
    && ['forensic', 'indicator', 'behavior', 'timing', 'context'].includes(item.category ?? '')
    && (['title', 'detail', 'source', 'corroboration'] as const).every(key => typeof item[key] === 'string' && item[key]!.length <= 1000)
    && typeof item.timestamp === 'number' && Number.isFinite(item.timestamp) && item.timestamp > 0 && item.timestamp <= Date.now() + 86_400_000
    && ['strong-lead', 'review', 'context'].includes(item.strength ?? '');
}

export function reviewEvidence(review: SecurityReview): IntegrityEvidence[] {
  if (review.sample) return [];
  return review.findings.slice(0, 100).filter(finding => finding.kind === 'indicator' || finding.kind === 'pattern' || finding.kind === 'behavior').map(finding => ({
    id: finding.id, category: finding.kind === 'indicator' ? 'indicator' : 'behavior', title: finding.title,
    detail: finding.detail, source: finding.source, timestamp: finding.timestamp,
    strength: finding.kind === 'indicator' ? 'review' : 'context',
    corroboration: finding.kind === 'indicator' ? 'Exact match in user-supplied indicators; verify source and context independently.' : 'Behavior clue alone; needs independent forensic evidence.',
  }));
}

export function timingEvidence(runs: readonly PerformanceRun[], history: readonly PerformanceRun[]): IntegrityEvidence[] {
  if (!runs.length) return [];
  const comparisons = runs.map(run => comparePerformanceRun(run, history));
  const slower = comparisons.filter(item => item.state === 'slower').length;
  const latest = runs[runs.length - 1];
  return [{ id: `timing-${latest.id}`, category: 'timing', title: slower >= 2 ? 'Repeated in-app slowdown' : 'In-app timing measured',
    detail: slower >= 2 ? `${slower} comparable runs were slower than the personal baseline. Heat, battery state, background activity, and build mode may explain this.` : comparisons[comparisons.length - 1].detail,
    source: 'IPward JavaScript timing only', timestamp: latest.recordedAt, strength: 'context',
    corroboration: 'No process attribution. Timing cannot establish spyware or a clean device.' }];
}

/** This is a review priority for collected clues, never an infection probability. */
export function evidencePriority(evidence: readonly IntegrityEvidence[]): { score: number; label: string } {
  const strong = evidence.filter(item => item.strength === 'strong-lead').length;
  const review = evidence.filter(item => item.strength === 'review').length;
  const context = evidence.filter(item => item.strength === 'context').length;
  const score = Math.min(100, strong * 45 + review * 18 + Math.min(20, context * 4));
  return { score, label: strong ? 'Specialist review advised' : review ? 'Review available leads' : 'Limited clues in available evidence' };
}

export interface CompanionArtifact {
  id: string;
  category: 'backup-record' | 'process' | 'profile' | 'network' | 'crash' | 'file';
  observedAt: number;
  summary: string;
  sourcePath: string;
  indicator?: string;
  family?: string;
}
export interface CompanionReport {
  schemaVersion: 1;
  type: 'ipward-companion-result';
  generatedAt: number;
  toolName: string;
  inputKind: 'encrypted-ios-backup' | 'android-export';
  artifacts: CompanionArtifact[];
  warnings: string[];
}

export const MAX_COMPANION_BYTES = 5_000_000;

export function parseCompanionReport(raw: string): CompanionReport {
  if (raw.length > MAX_COMPANION_BYTES) throw new Error('The companion report exceeds the 5 MB import limit.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('The companion report is not valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an IPward companion report object.');
  const report = value as Partial<CompanionReport>;
  if (report.schemaVersion !== 1 || report.type !== 'ipward-companion-result' || typeof report.generatedAt !== 'number'
    || !Number.isFinite(report.generatedAt) || report.generatedAt <= 0 || report.generatedAt > Date.now() + 86_400_000
    || typeof report.toolName !== 'string' || !report.toolName.trim() || report.toolName.length > 120
    || (report.inputKind !== 'encrypted-ios-backup' && report.inputKind !== 'android-export')
    || !Array.isArray(report.artifacts) || report.artifacts.length > 1000 || !Array.isArray(report.warnings) || report.warnings.length > 100
    || !report.warnings.every(item => typeof item === 'string' && item.length <= 500)) throw new Error('Unsupported or malformed companion report. Use schema version 1.');
  const categories = new Set(['backup-record', 'process', 'profile', 'network', 'crash', 'file']);
  const ids = new Set<string>();
  for (const artifact of report.artifacts) {
    if (!artifact || typeof artifact !== 'object' || !categories.has(artifact.category) || typeof artifact.id !== 'string'
      || !artifact.id || artifact.id.length > 100 || ids.has(artifact.id)
      || typeof artifact.observedAt !== 'number' || !Number.isFinite(artifact.observedAt) || artifact.observedAt <= 0
      || artifact.observedAt > Date.now() + 86_400_000 || typeof artifact.summary !== 'string' || !artifact.summary || artifact.summary.length > 500
      || typeof artifact.sourcePath !== 'string' || !artifact.sourcePath || artifact.sourcePath.length > 500
      || (artifact.indicator !== undefined && (typeof artifact.indicator !== 'string' || artifact.indicator.length > 300))
      || (artifact.family !== undefined && (typeof artifact.family !== 'string' || artifact.family.length > 100))) throw new Error('A companion artifact is malformed or duplicated.');
    ids.add(artifact.id);
  }
  return report as CompanionReport;
}

export function companionEvidence(report: CompanionReport, indicators: SecurityIndicatorSet | null = null): IntegrityEvidence[] {
  const exact = new Set([...(indicators?.domains ?? []), ...(indicators?.ips ?? []), ...(indicators?.appIds ?? [])]);
  return report.artifacts.map(item => {
    const matched = !!item.indicator && exact.has(item.indicator.toLowerCase());
    return { id: `companion-${item.id}`, category: 'forensic', title: item.category.replace(/-/g, ' '),
      detail: `${item.summary}${item.indicator ? ` · Companion indicator: ${item.indicator}` : ''}${matched ? ' · Exact match in your imported STIX2 file' : ''}${item.family ? ` · Reported family: ${item.family} (unverified)` : ''}`,
      source: `${report.toolName} · ${item.sourcePath}`, timestamp: item.observedAt,
      strength: matched ? 'review' as const : 'context' as const,
      corroboration: 'Imported companion output and indicator files are user supplied. Verify raw artifacts and indicator provenance with a qualified examiner.',
    };
  });
}
