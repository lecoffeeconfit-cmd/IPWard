import type { CaptureSession, PrivacyDataset } from '../types';

/** UTF-8 payload size without requiring browser TextEncoder or Node Buffer. */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

/** Quotes every field and prevents strings from becoming spreadsheet formulas. */
export function encodeCsvCell(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function createConnectionCsv(dataset: PrivacyDataset): string {
  const headings = ['id', 'timestamp_utc', 'data_mode', 'source', 'app', 'app_id', 'domain', 'ip', 'organization', 'country', 'category', 'uploaded_bytes', 'downloaded_bytes', 'reported_contacts', 'apple_potential_cross_app_flag', 'foreground_state', 'evidence_state', 'confidence', 'evidence_explanation'];
  const appNames = new Map(dataset.apps.map(app => [app.id, app.name]));
  const organizationNames = new Map(dataset.organizations.map(organization => [organization.id, organization.name]));
  const rows = dataset.connections.map(event => [
    event.id, new Date(event.timestamp).toISOString(), event.source === 'demo' ? 'demo' : 'device', event.source,
    appNames.get(event.appId ?? '') ?? 'Unattributed', event.appId, event.domain, event.ip,
    organizationNames.get(event.organizationId ?? '') ?? 'Unknown organization', event.country, event.category,
    event.bytesMeasured === false ? null : event.bytesUploaded, event.bytesMeasured === false ? null : event.bytesDownloaded, event.reportHits ?? null, event.potentialTracker === undefined ? null : event.potentialTracker ? 'true' : 'false', event.foregroundState, event.provenance.state,
    event.provenance.confidence, event.provenance.explanation,
  ]);
  return [headings, ...rows].map(row => row.map(encodeCsvCell).join(',')).join('\r\n');
}

export function createActivityReport(dataset: PrivacyDataset, captures: readonly CaptureSession[], range: string, now = Date.now()): string {
  return JSON.stringify({
    product: 'IPward',
    schemaVersion: 1,
    exportedAt: new Date(now).toISOString(),
    range,
    dataNotice: dataset.mode === 'demo'
      ? 'Illustrative sample activity. No activity was collected from this device. Saved captures carry their own mode and source labels.'
      : 'Device workspace. Imported Apple report records are historical aggregates, not live captures. Saved captures carry their own mode and source labels.',
    limitations: [
      'Evidence state and event source must be read together. Demo events are illustrative, including those labelled Observed or Confirmed.',
      'Endpoint locations do not establish where personal information is stored.',
      'Encrypted communication contents are unavailable.',
      'Null or empty transfer bytes mean the observation source did not provide a byte count; they do not mean zero bytes.',
    ],
    dataset,
    captures,
  }, null, 2);
}
