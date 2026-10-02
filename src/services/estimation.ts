import { CommunicationEstimate, EventSource } from '../types';
import { CapabilityMatrix, CapabilityKey } from './capabilities';

export interface CommunicationSignal { id: string; type: 'app-usage' | 'notification' | 'network-burst'; appId: string; timestamp: number; authorized: boolean; source: EventSource }
const required: Record<CommunicationSignal['type'], CapabilityKey> = { 'app-usage': 'deviceActivity', notification: 'notificationActivity', 'network-burst': 'networkMonitoring' };

/** A conservative research foundation: infer activity windows, never sent/received messages. */
export function estimateCommunicationActivity(signals: readonly CommunicationSignal[], capabilities: CapabilityMatrix, now = Date.now()): CommunicationEstimate {
  const usable = signals.filter(signal => signal.authorized && Number.isFinite(signal.timestamp) && signal.timestamp <= now && capabilities[required[signal.type]].available && ((signal.source === 'demo') === (capabilities[required[signal.type]].state === 'demo')));
  const windows = new Map<string, CommunicationSignal[]>();
  usable.forEach(signal => { const key = `${signal.appId}:${Math.floor(signal.timestamp / 120000)}`; windows.set(key, [...(windows.get(key) ?? []), signal]); });
  const aligned = [...windows.values()].filter(window => new Set(window.map(signal => signal.type)).size >= 2 && window.some(signal => signal.type === 'app-usage') && window.some(signal => signal.type === 'notification'));
  const inputSignals = [...new Set(aligned.flat().map(signal => signal.id))];
  const source = usable[0]?.source ?? 'demo';
  return { value: aligned.length || null, unit: 'activity windows', state: aligned.length ? 'Estimated' : 'Unavailable', confidence: aligned.length ? 'medium' : 'low', inputSignals, timestamp: now, algorithmVersion: 'activity-windows/1.0.0', source, explanation: aligned.length ? 'Two-minute periods with authorized app usage and notification metadata for the same app. This indicates possible communication activity, not message counts, direction, content, or recipients.' : 'Insufficient authorized, correlated app-usage and notification signals. Network traffic alone cannot establish messages or communication activity.' };
}
