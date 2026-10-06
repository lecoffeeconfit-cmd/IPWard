export type ProbePlatform = 'ios' | 'android' | 'web';

export interface PerformanceRun {
  version: 1;
  id: string;
  recordedAt: number;
  platform: ProbePlatform;
  development: boolean;
  controlled: boolean;
  timerMedianMs: number;
  timerP95Ms: number;
  lateFramePercent: number;
  workMedianMs: number;
  durationMs: number;
}

export interface PerformanceComparison {
  state: 'conditions' | 'baseline' | 'usual' | 'mixed' | 'slower';
  title: string;
  detail: string;
  baselineCount: number;
  baselineTimerP95Ms: number | null;
  baselineWorkMedianMs: number | null;
}

const TIMER_MS = 50;
const TIMER_SAMPLES = 12;
const FRAME_SAMPLES = 24;
const WORK_SAMPLES = 5;

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

function rounded(value: number): number { return Math.round(value * 10) / 10; }

function wait(ms: number): Promise<void> { return new Promise(resolve => { setTimeout(resolve, ms); }); }

function nextFrame(): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cancelAnimationFrame(frame); reject(new Error('The timing check paused. Keep IPward open and try again.')); }, 1500);
    const frame = requestAnimationFrame(time => { clearTimeout(timeout); resolve(time); });
  });
}

/** Measures only this app's JS scheduling and a small local task while visible. */
export async function runPerformanceProbe(
  platform: ProbePlatform,
  development: boolean,
  controlled: boolean,
  isActive: () => boolean,
  onProgress?: (fraction: number) => void,
): Promise<PerformanceRun> {
  if (!isActive()) throw new Error('Keep IPward open in the foreground during the timing check.');
  const started = performance.now();
  const timerDelays: number[] = [];
  const frameGaps: number[] = [];
  const workTimes: number[] = [];
  const total = TIMER_SAMPLES + FRAME_SAMPLES + WORK_SAMPLES;
  let completed = 0;
  const step = () => { completed++; onProgress?.(completed / total); if (!isActive()) throw new Error('The timing check was interrupted. Keep IPward open and try again.'); };

  for (let i = 0; i < TIMER_SAMPLES; i++) {
    const scheduled = performance.now();
    await wait(TIMER_MS);
    timerDelays.push(Math.max(0, performance.now() - scheduled - TIMER_MS));
    step();
  }
  let priorFrame = await nextFrame();
  for (let i = 0; i < FRAME_SAMPLES; i++) {
    const frame = await nextFrame();
    frameGaps.push(Math.max(0, frame - priorFrame));
    priorFrame = frame;
    step();
  }
  let checksum = 2166136261;
  for (let round = 0; round < WORK_SAMPLES; round++) {
    await wait(0);
    const before = performance.now();
    for (let i = 0; i < 100_000; i++) checksum = Math.imul(checksum ^ (i + round), 16777619);
    workTimes.push(performance.now() - before);
    step();
  }
  // Use the result so the calculation remains observable to the JS engine.
  if (!Number.isFinite(checksum)) throw new Error('The timing check could not finish.');
  const recordedAt = Date.now();
  return {
    version: 1,
    id: `${recordedAt}-${Math.random().toString(36).slice(2, 8)}`,
    recordedAt,
    platform,
    development,
    controlled,
    timerMedianMs: rounded(percentile(timerDelays, 0.5)),
    timerP95Ms: rounded(percentile(timerDelays, 0.95)),
    lateFramePercent: rounded(100 * frameGaps.filter(gap => gap > 34).length / frameGaps.length),
    workMedianMs: rounded(percentile(workTimes, 0.5)),
    durationMs: rounded(performance.now() - started),
  };
}

export function isStoredPerformanceRun(value: unknown): value is PerformanceRun {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const run = value as Partial<PerformanceRun>;
  return run.version === 1 && typeof run.id === 'string' && /^[0-9]+-[a-z0-9]{1,12}$/.test(run.id)
    && typeof run.recordedAt === 'number' && Number.isFinite(run.recordedAt) && run.recordedAt > 0 && run.recordedAt < Date.now() + 86_400_000
    && (run.platform === 'ios' || run.platform === 'android' || run.platform === 'web')
    && typeof run.development === 'boolean' && typeof run.controlled === 'boolean'
    && (['timerMedianMs', 'timerP95Ms', 'lateFramePercent', 'workMedianMs', 'durationMs'] as const).every(key => typeof run[key] === 'number' && Number.isFinite(run[key]) && run[key] >= 0 && run[key] <= (key === 'lateFramePercent' ? 100 : 60_000));
}

/** Compare only clean-condition runs from the same device runtime. Never infer spyware likelihood. */
export function comparePerformanceRun(current: PerformanceRun, history: readonly PerformanceRun[]): PerformanceComparison {
  const neutral = { baselineCount: 0, baselineTimerP95Ms: null, baselineWorkMedianMs: null };
  if (!current.controlled) return { state: 'conditions', title: 'Conditions were not confirmed', detail: 'This run is saved for reference, but it will not set or use a baseline. Repeat when the phone is cool, updated and otherwise idle.', ...neutral };
  if (current.platform === 'web') return { state: 'conditions', title: 'Browser preview only', detail: 'These numbers describe this browser, not a phone. Run the check in the iOS or Android app.', ...neutral };
  if (current.development) return { state: 'conditions', title: 'Development build result', detail: 'Debug tooling can change timings. Use a release build for a personal baseline.', ...neutral };

  const previous = history.filter(run => run.id !== current.id && run.recordedAt < current.recordedAt
    && run.platform === current.platform && !run.development && run.controlled).sort((a, b) => b.recordedAt - a.recordedAt).slice(0, 6);
  if (previous.length < 3) return { state: 'baseline', title: 'Building your baseline', detail: `${previous.length + 1} of 4 comparable runs collected. Repeat under similar calm conditions on another day.`, baselineCount: previous.length, baselineTimerP95Ms: null, baselineWorkMedianMs: null };

  const timer = rounded(percentile(previous.map(run => run.timerP95Ms), 0.5));
  const work = rounded(percentile(previous.map(run => run.workMedianMs), 0.5));
  const late = percentile(previous.map(run => run.lateFramePercent), 0.5);
  const changed = [
    current.timerP95Ms > Math.max(timer * 2.5, timer + 30),
    current.workMedianMs > Math.max(work * 1.8, work + 3),
    current.lateFramePercent > Math.max(late * 2, late + 20),
  ].filter(Boolean).length;
  const base = { baselineCount: previous.length, baselineTimerP95Ms: timer, baselineWorkMedianMs: work };
  if (changed >= 2) return { state: 'slower', title: 'Slower than your usual runs', detail: 'At least two in-app timing measures changed substantially. Repeat the check, review battery, storage and temperature, and use the other Security Center evidence before drawing conclusions.', ...base };
  if (changed === 1) return { state: 'mixed', title: 'One timing measure changed', detail: 'A single slower measure is common and may be temporary. Repeat under the same conditions before treating it as a trend.', ...base };
  return { state: 'usual', title: 'Close to your usual runs', detail: 'These in-app timings are within your recent range. This says nothing about whether spyware is present or absent.', ...base };
}
