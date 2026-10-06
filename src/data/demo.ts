import { AppProfile, CommunicationEvent, ConnectionEvent, Organization, PrivacyDataset, Provenance, SensorEvent, SensorType } from '../types';
import { classifyDomain } from '../services/classifier';

export const DEMO_NOTICE = 'Sample activity · This is a guided preview, not activity collected from your phone.';
const observed: Provenance = { state: 'Observed', source: 'demo', confidence: 'high', explanation: 'Illustrative sample event. No activity was collected from this device.' };
const confirmed: Provenance = { state: 'Confirmed', source: 'demo', confidence: 'high', explanation: 'Simulated authorized integration. No account is connected.' };
const permission = (sensor: SensorType, level: 'Allowed' | 'While using' | 'Limited' = 'Allowed') => ({ sensor, level, provenance: confirmed });

export const APPS: AppProfile[] = [
  { id: 'instagram', identifier: 'com.burbn.instagram', name: 'Instagram', initials: 'ig', color: '#ED759B', icon: 'logo-instagram', category: 'Social', permissions: [permission('Microphone'), permission('Camera'), permission('Location', 'While using'), permission('Photos', 'Limited')], source: 'demo' },
  { id: 'spotify', identifier: 'com.spotify.client', name: 'Spotify', initials: 'S', color: '#56D88B', icon: 'musical-notes', category: 'Entertainment', permissions: [permission('Bluetooth')], source: 'demo' },
  { id: 'safari', identifier: 'com.apple.mobilesafari', name: 'Safari', initials: 'S', color: '#62BBF4', icon: 'compass', category: 'Browser', permissions: [permission('Location', 'While using'), permission('Camera')], source: 'demo' },
  { id: 'weather', identifier: 'com.apple.weather', name: 'Weather', initials: 'W', color: '#F8C96C', icon: 'partly-sunny', category: 'Utilities', permissions: [permission('Location', 'While using')], source: 'demo' },
  { id: 'whatsapp', identifier: 'net.whatsapp.WhatsApp', name: 'WhatsApp', initials: 'W', color: '#61DDB0', icon: 'logo-whatsapp', category: 'Communication', permissions: [permission('Microphone'), permission('Camera'), permission('Contacts')], source: 'demo' },
  { id: 'maps', identifier: 'com.apple.Maps', name: 'Maps', initials: 'M', color: '#86A4FA', icon: 'map', category: 'Navigation', permissions: [permission('Location', 'While using')], source: 'demo' },
  { id: 'outlook', identifier: 'com.microsoft.Office.Outlook', name: 'Outlook', initials: 'O', color: '#70A9F7', icon: 'mail', category: 'Communication', permissions: [permission('Contacts'), permission('Calendar')], source: 'demo' },
  { id: 'notion', identifier: 'notion.id', name: 'Notion', initials: 'N', color: '#C5C8D1', icon: 'document-text', category: 'Productivity', permissions: [permission('Photos', 'Limited')], source: 'demo' },
];

export const ORGANIZATIONS: Organization[] = [
  { id: 'meta', name: 'Meta', initials: 'M', color: '#83ABFF', description: 'Social, communication, and content delivery infrastructure.' },
  { id: 'google', name: 'Google', initials: 'G', color: '#F8C96C', description: 'Endpoints include authentication, analytics, and advertising services; classification is endpoint-specific.' },
  { id: 'apple', name: 'Apple', initials: 'A', color: '#B4BECF', description: 'Device, cloud, and maps services.' },
  { id: 'spotify', name: 'Spotify', initials: 'S', color: '#56D88B', description: 'Music application services and content delivery.' },
  { id: 'cloudflare', name: 'Cloudflare', initials: 'C', color: '#F2A573', description: 'Shared content delivery infrastructure. Hosting alone does not identify the end recipient.' },
  { id: 'appsflyer', name: 'AppsFlyer', initials: 'A', color: '#77DCCA', description: 'Infrastructure associated with mobile attribution and marketing.' },
  { id: 'adjust', name: 'Adjust', initials: 'a', color: '#AF9EF5', description: 'Infrastructure associated with mobile attribution.' },
  { id: 'microsoft', name: 'Microsoft', initials: 'M', color: '#6DAEF9', description: 'Communication and cloud application services.' },
  { id: 'notion', name: 'Notion', initials: 'N', color: '#C5C8D1', description: 'Workspace and productivity application services.' },
];

interface Seed { appId: string; domain: string; country: string; code: string; region: string; upload: number; download: number; background?: boolean }
const SEEDS: Seed[] = [
  { appId: 'instagram', domain: 'graph.instagram.com', country: 'United States', code: 'US', region: 'Virginia', upload: 560000, download: 4200000 },
  { appId: 'spotify', domain: 'audio-fa.scdn.co', country: 'Sweden', code: 'SE', region: 'Stockholm', upload: 34000, download: 15300000, background: true },
  { appId: 'safari', domain: 'www.cloudflare.com', country: 'United States', code: 'US', region: 'California', upload: 245000, download: 5700000 },
  { appId: 'weather', domain: 'weather-edge.example', country: 'Ireland', code: 'IE', region: 'Dublin', upload: 97000, download: 842000, background: true },
  { appId: 'whatsapp', domain: 'g.whatsapp.net', country: 'Ireland', code: 'IE', region: 'Dublin', upload: 1740000, download: 2830000 },
  { appId: 'maps', domain: 'gspe1-ssl.apple-mapkit.com', country: 'United States', code: 'US', region: 'California', upload: 105000, download: 5640000 },
  { appId: 'outlook', domain: 'outlook.office365.com', country: 'Netherlands', code: 'NL', region: 'Amsterdam', upload: 1440000, download: 1580000, background: true },
  { appId: 'notion', domain: 'api.notion.com', country: 'United States', code: 'US', region: 'Oregon', upload: 1880000, download: 720000 },
  { appId: 'safari', domain: 'www.google-analytics.com', country: 'United States', code: 'US', region: 'Virginia', upload: 38000, download: 17000, background: true },
  { appId: 'instagram', domain: 'scontent.cdninstagram.com', country: 'Singapore', code: 'SG', region: 'Singapore', upload: 217000, download: 18400000 },
  { appId: 'notion', domain: 'events.appsflyer.com', country: 'Germany', code: 'DE', region: 'Frankfurt', upload: 14000, download: 7000, background: true },
  { appId: 'spotify', domain: 'api.spotify.com', country: 'Sweden', code: 'SE', region: 'Stockholm', upload: 198000, download: 852000 },
  { appId: 'safari', domain: 'ad.doubleclick.net', country: 'United States', code: 'US', region: 'Virginia', upload: 24000, download: 89000 },
  { appId: 'outlook', domain: 'accounts.google.com', country: 'United States', code: 'US', region: 'California', upload: 31000, download: 41000 },
  { appId: 'weather', domain: 'app-measurement.com', country: 'Germany', code: 'DE', region: 'Frankfurt', upload: 26000, download: 12000, background: true },
  { appId: 'instagram', domain: 'app.adjust.com', country: 'Germany', code: 'DE', region: 'Frankfurt', upload: 17000, download: 9500, background: true },
  { appId: 'notion', domain: 'upload.icloud.com', country: 'Ireland', code: 'IE', region: 'Dublin', upload: 8250000, download: 112000, background: true },
];

/** Stable for a given anchor; all app/provider associations and locations are fictional examples. */
export function createDemoDataset(anchor = Date.now()): PrivacyDataset {
  const connections: ConnectionEvent[] = [];
  const sensors: SensorEvent[] = [];
  const communications: CommunicationEvent[] = [];
  const today = new Date(anchor); today.setHours(0, 0, 0, 0);
  for (let day = 0; day < 30; day += 1) {
    const date = new Date(today); date.setDate(date.getDate() - day);
    const nextDate = new Date(date); nextDate.setDate(nextDate.getDate() + 1);
    const start = date.getTime();
    const end = day === 0 ? anchor : nextDate.getTime() - 1;
    const span = Math.max(1, end - start);
    const total = day === 0 ? 317 : 171 + ((day * 29) % 137);
    for (let index = 0; index < total; index += 1) {
      const seed = SEEDS[(index + day * 3) % SEEDS.length];
      const classification = classifyDomain(seed.domain);
      const weight = 0.65 + ((index * 13 + day * 7) % 97) / 100;
      connections.push({ id: `demo-connection-${day}-${index}`, timestamp: start + Math.floor(span * (index + 1) / (total + 1)), appId: seed.appId, domain: seed.domain, ip: `203.0.113.${(index % 250) + 1}`, port: 443, protocol: index % 4 === 0 ? 'QUIC' : 'TLS', organizationId: classification.organizationId, country: seed.country, countryCode: seed.code, region: seed.region, asn: 'Documentation address', bytesUploaded: Math.round(seed.upload * weight), bytesDownloaded: Math.round(seed.download * weight), foregroundState: seed.background ? 'background' : 'foreground', category: classification.categories[0], classification, isNewDestination: false, source: 'demo', provenance: observed });
    }
    const sensorSeeds: { sensor: SensorType; count: number; apps: string[] }[] = [
      { sensor: 'Microphone', count: day === 0 ? 7 : 2 + day % 7, apps: ['whatsapp', 'instagram'] },
      { sensor: 'Camera', count: day === 0 ? 3 : 1 + day % 4, apps: ['instagram', 'whatsapp'] },
      { sensor: 'Location', count: day === 0 ? 34 : 14 + day % 23, apps: ['maps', 'weather', 'safari', 'instagram'] },
      { sensor: 'Photos', count: 4, apps: ['instagram', 'notion'] },
      { sensor: 'Contacts', count: 2, apps: ['whatsapp', 'outlook'] },
    ];
    sensorSeeds.forEach(({ sensor, count, apps }) => {
      for (let index = 0; index < count; index += 1) {
        const timestamp = start + Math.floor(span * (index + 1) / (count + 1));
        sensors.push({ id: `demo-sensor-${day}-${sensor}-${index}`, timestamp, timestampEnd: Math.min(end, timestamp + (12 + index % 37) * 1000), appId: apps[index % apps.length], sensor, foregroundState: sensor === 'Location' && index % 3 === 0 ? 'background' : 'foreground', source: 'demo', provenance: observed });
      }
    });
    const base = { source: 'demo' as const, provenance: confirmed };
    for (let index = 0; index < 5; index += 1) communications.push({ ...base, id: `demo-call-${day}-${index}`, timestamp: start + span * (index + 1) / 7, appId: 'whatsapp', type: 'call', direction: index % 2 ? 'outgoing' : 'incoming', durationSeconds: [213, 486, 124, 619, 460][index], count: 1 });
    communications.push(
      { ...base, id: `demo-email-in-${day}`, timestamp: start + span * 0.8, appId: 'outlook', type: 'email', direction: 'incoming', durationSeconds: 0, count: 43 - day % 17 },
      { ...base, id: `demo-email-out-${day}`, timestamp: start + span * 0.7, appId: 'outlook', type: 'email', direction: 'outgoing', durationSeconds: 0, count: 12 - day % 7 },
      { ...base, provenance: observed, id: `demo-notifications-${day}`, timestamp: start + span * 0.9, appId: 'whatsapp', type: 'notification', direction: 'unknown', durationSeconds: 0, count: 28 + day % 8 },
      { ...base, id: `demo-usage-${day}`, timestamp: start + span * 0.9, appId: 'whatsapp', type: 'app-usage', direction: 'unknown', durationSeconds: 6420 - day % 8 * 160, count: 1 },
      { ...base, id: `demo-email-usage-${day}`, timestamp: start + span * 0.9, appId: 'outlook', type: 'app-usage', direction: 'unknown', durationSeconds: 1860 - day % 6 * 120, count: 1 },
    );
  }
  const newDomain = 'sync-edge.example';
  const newClassification = classifyDomain(newDomain);
  connections.push({
    id: 'demo-connection-first-seen',
    timestamp: Math.max(today.getTime(), anchor - 2 * 60_000),
    appId: 'instagram',
    domain: newDomain,
    ip: '',
    port: 0,
    protocol: 'Unknown',
    organizationId: null,
    country: '',
    countryCode: '',
    region: '',
    asn: '',
    bytesUploaded: 0,
    bytesDownloaded: 0,
    bytesMeasured: false,
    foregroundState: 'unknown',
    category: 'Unknown',
    classification: newClassification,
    isNewDestination: true,
    source: 'demo',
    provenance: observed,
  });
  connections.sort((a, b) => b.timestamp - a.timestamp);
  sensors.sort((a, b) => b.timestamp - a.timestamp);
  communications.sort((a, b) => b.timestamp - a.timestamp);
  const newConnection = connections.find(event => event.isNewDestination)!;
  const upload = connections.find(event => event.foregroundState === 'background' && event.bytesUploaded > 5000000)!;
  const analytics = connections.find(event => event.category === 'Analytics')!;
  return { mode: 'demo', generatedAt: anchor, apps: APPS, organizations: ORGANIZATIONS, connections, sensors, communications, alerts: [
    { id: 'demo-alert-destination', timestamp: newConnection.timestamp, appId: newConnection.appId!, title: 'A new destination appeared', description: `${APPS.find(app => app.id === newConnection.appId)?.name} contacted a destination not seen earlier in this sample.`, severity: 'Information', connectionId: newConnection.id, source: 'demo' },
    { id: 'demo-alert-upload', timestamp: upload.timestamp, appId: upload.appId!, title: 'A larger background upload', description: 'A sample cloud sync transferred more than 5 MB while the app was in the background.', severity: 'Notice', connectionId: upload.id, source: 'demo' },
    { id: 'demo-alert-analytics', timestamp: analytics.timestamp, appId: analytics.appId!, title: 'Analytics infrastructure contacted', description: 'An endpoint in the sample is associated with analytics. Encrypted contents are unavailable.', severity: 'Information', connectionId: analytics.id, source: 'demo' },
  ] };
}

export const DEMO_DATASET = createDemoDataset();
export function createEmptyDataset(now = Date.now()): PrivacyDataset {
  return { mode: 'device', generatedAt: now, apps: [], organizations: [], connections: [], sensors: [], communications: [], alerts: [] };
}
