import { ConnectionEvent, SensorEvent, SensorType } from '../types';

export type ModalitySignal =
  | { kind: 'access'; event: SensorEvent }
  | { kind: 'contact'; event: ConnectionEvent };

export interface ModalitySummary {
  microphoneAccesses: number;
  otherAccesses: { sensor: SensorType; count: number }[];
  domainContacts: number;
  recent: ModalitySignal[];
}

/** Keep resource access and network contact as separate facts. Neither reveals content. */
export function summarizeModalities(appId: string, sensors: readonly SensorEvent[], connections: readonly ConnectionEvent[], limit = 10): ModalitySummary {
  const accesses = sensors.filter(event => event.appId === appId);
  const contacts = connections.filter(event => event.appId === appId);
  const otherCounts = new Map<SensorType, number>();
  for (const event of accesses) {
    if (event.sensor !== 'Microphone') otherCounts.set(event.sensor, (otherCounts.get(event.sensor) ?? 0) + 1);
  }
  return {
    microphoneAccesses: accesses.filter(event => event.sensor === 'Microphone').length,
    otherAccesses: [...otherCounts].map(([sensor, count]) => ({ sensor, count })).sort((a, b) => b.count - a.count || a.sensor.localeCompare(b.sensor)),
    domainContacts: contacts.length,
    recent: [
      ...accesses.map(event => ({ kind: 'access' as const, event })),
      ...contacts.map(event => ({ kind: 'contact' as const, event })),
    ].sort((a, b) => b.event.timestamp - a.event.timestamp || a.event.id.localeCompare(b.event.id)).slice(0, Math.max(0, limit)),
  };
}

export function resourceMeaning(sensor: SensorType): string {
  switch (sensor) {
    case 'Microphone': return 'Microphone input was accessed. Sound and spoken words are unavailable.';
    case 'Camera': return 'Camera access was recorded. Images and video are unavailable.';
    case 'Location': return 'Location access was recorded. The accessed coordinates are unavailable.';
    case 'Photos': return 'Photo library access was recorded. Which photos were viewed is unavailable.';
    case 'Contacts': return 'Contacts access was recorded. Which entries were read is unavailable.';
    case 'Bluetooth': return 'Bluetooth access was recorded. Nearby device details are unavailable.';
    case 'Calendar': return 'Calendar access was recorded. Event contents are unavailable.';
  }
}
