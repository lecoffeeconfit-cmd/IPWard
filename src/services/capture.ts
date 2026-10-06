import { CaptureSession, DataMode, PrivacyDataset } from '../types';
import { summarizeConnections } from './analytics';

export function createCapture(mode: DataMode, appId: string | null = null, now = Date.now()): CaptureSession {
  return { id: `capture-${now}-${Math.random().toString(36).slice(2, 8)}`, name: mode === 'demo' ? 'Sample capture' : 'Capture session', mode, kind: mode === 'demo' ? 'demo' : 'live', startedAt: now, endedAt: null, appId, status: 'recording', connections: [], sensors: [], summary: summarizeConnections([]), notes: '', schemaVersion: 1 };
}

/** Saves a point-in-time copy of an imported report. This is never presented as a live capture. */
export function createImportedSnapshot(dataset: PrivacyDataset, appId: string | null, name: string, now = Date.now()): CaptureSession {
  if (dataset.mode !== 'device') throw new Error('Only device-workspace reports can be saved as snapshots.');
  const connections = dataset.connections.filter(event => event.source === 'user-import' && (!appId || event.appId === appId));
  const sensors = dataset.sensors.filter(event => event.source === 'user-import' && (!appId || event.appId === appId));
  if (!connections.length && !sensors.length) throw new Error('No imported report records match this selection.');
  return { id: `snapshot-${now}-${Math.random().toString(36).slice(2, 8)}`, name: name.trim().slice(0, 80) || 'Apple report snapshot', mode: 'device', kind: 'report-snapshot', startedAt: now, endedAt: now, appId, status: 'saved', connections, sensors, summary: summarizeConnections(connections), notes: 'Historical Apple App Privacy Report snapshot. Domain rows aggregate contacts over the report window; this is not a live capture.', schemaVersion: 1 };
}

/** Demo capture replays existing sample observations into the elapsed capture window. */
export function updateCapture(capture: CaptureSession, dataset: PrivacyDataset, now = Date.now()): CaptureSession {
  if (capture.status !== 'recording' || capture.mode !== dataset.mode) return capture;
  const end = Math.max(capture.startedAt, now);
  if (capture.mode === 'device') {
    const connections = dataset.connections.filter(event => event.source !== 'demo' && event.timestamp >= capture.startedAt && event.timestamp <= end && (!capture.appId || event.appId === capture.appId));
    const sensors = dataset.sensors.filter(event => event.source !== 'demo' && event.timestamp >= capture.startedAt && event.timestamp <= end && (!capture.appId || event.appId === capture.appId));
    return { ...capture, connections, sensors, summary: summarizeConnections(connections) };
  }
  const elapsedSeconds = Math.max(0, Math.floor((end - capture.startedAt) / 1000));
  const candidates = dataset.connections.filter(event => !capture.appId || event.appId === capture.appId);
  const count = Math.min(candidates.length, Math.floor(elapsedSeconds / 2));
  const connections = candidates.slice(0, count).map((event, index) => ({ ...event, id: `${capture.id}-event-${index}`, captureSessionId: capture.id, timestamp: capture.startedAt + (index + 1) * 2000 }));
  const sensors = dataset.sensors.filter(event => !capture.appId || event.appId === capture.appId).slice(0, Math.floor(elapsedSeconds / 9)).map((event, index) => ({ ...event, id: `${capture.id}-sensor-${index}`, timestamp: capture.startedAt + (index + 1) * 9000, timestampEnd: Math.min(end, capture.startedAt + (index + 1) * 9000 + 1000) }));
  return { ...capture, connections, sensors, summary: summarizeConnections(connections) };
}

export function finishCapture(capture: CaptureSession, dataset: PrivacyDataset, now = Date.now()): CaptureSession {
  if (capture.status === 'saved') return capture;
  if (capture.mode !== dataset.mode) throw new Error('Capture source does not match the current dataset.');
  const updated = updateCapture(capture, dataset, now);
  return { ...updated, status: 'saved', endedAt: Math.max(capture.startedAt, now) };
}

export function compareCaptures(before: CaptureSession, after: CaptureSession) {
  if (before.mode !== after.mode) throw new Error('Sample captures cannot be compared with device captures.');
  if ((before.kind ?? 'demo') !== (after.kind ?? 'demo')) throw new Error('Compare two reports from the same capture source.');
  const beforeDomains = new Set(before.connections.map(event => event.domain));
  return { before, after, deltas: { connections: after.summary.connections - before.summary.connections, uploaded: after.summary.uploaded - before.summary.uploaded, downloaded: after.summary.downloaded - before.summary.downloaded, organizations: after.summary.organizations - before.summary.organizations, marketing: after.summary.marketing - before.summary.marketing, background: after.summary.background - before.summary.background }, newDomains: [...new Set(after.connections.map(event => event.domain))].filter(domain => !beforeDomains.has(domain)) };
}

export function exportCaptureJSON(capture: CaptureSession): string {
  return JSON.stringify({ product: 'IPward', reportType: capture.kind === 'report-snapshot' ? 'historical-report-snapshot' : 'capture', exportedAt: new Date().toISOString(), notice: capture.mode === 'demo' ? 'SAMPLE DATA. This report does not describe activity on your device.' : capture.kind === 'report-snapshot' ? 'Historical user-imported Apple report. Domain rows summarize contacts over a rolling window, not live connections. Transfer bytes are unavailable.' : 'This report includes sensitive connection metadata. Share it only with people you trust.', limitations: ['Encrypted payload contents are unavailable.', 'Apple domain rows may include first and latest contact times but not intermediate contact times.', 'Endpoint country does not establish where personal information is stored.', 'Endpoint categories and timing proximity do not establish the purpose or contents of a specific transfer.'], capture }, null, 2);
}

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  // Prevent spreadsheet formula execution when imported into Excel or Sheets.
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function exportCaptureCSV(capture: CaptureSession): string {
  const header = ['source', 'timestamp', 'first_contact_utc', 'app_id', 'domain', 'organization_id', 'country', 'category', 'uploaded_bytes', 'downloaded_bytes', 'reported_contacts', 'foreground_state', 'evidence'];
  const rows = capture.connections.map(event => [event.source, new Date(event.timestamp).toISOString(), event.reportFirstAt ? new Date(event.reportFirstAt).toISOString() : null, event.appId ?? '', event.domain, event.organizationId ?? '', event.country, event.category, event.bytesMeasured === false ? null : event.bytesUploaded, event.bytesMeasured === false ? null : event.bytesDownloaded, event.reportHits ?? null, event.foregroundState, event.provenance.state]);
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}
