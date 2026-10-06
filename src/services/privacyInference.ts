import { ConnectionEvent, SensorEvent } from '../types';

/** A time comparison, not an estimate of payload, speech, targeting, or causation. */
export interface TimingClue {
  sensor: SensorEvent;
  gapMs: number;
  relation: 'before' | 'overlap' | 'after';
  confidence: 'low';
  method: 'latest-contact-proximity/1';
}

/** Apple reports expose the latest domain contact but not every intermediate contact.
 *  Only compare that exact timestamp with access intervals from the same app.
 */
export function estimateTimingClue(contact: ConnectionEvent, sensors: readonly SensorEvent[], windowMs = 15 * 60_000): TimingClue | null {
  if (contact.source !== 'user-import' || !contact.potentialTracker || !contact.appId || !Number.isFinite(windowMs) || windowMs < 0) return null;
  let closest: TimingClue | null = null;
  for (const sensor of sensors) {
    if (sensor.source !== 'user-import' || sensor.appId !== contact.appId) continue;
    const relation = sensor.timestamp > contact.timestamp ? 'after' : sensor.timestampEnd < contact.timestamp ? 'before' : 'overlap';
    const gapMs = relation === 'after' ? sensor.timestamp - contact.timestamp : relation === 'before' ? contact.timestamp - sensor.timestampEnd : 0;
    if (gapMs > windowMs || closest && gapMs >= closest.gapMs) continue;
    closest = { sensor, gapMs, relation, confidence: 'low', method: 'latest-contact-proximity/1' };
  }
  return closest;
}
