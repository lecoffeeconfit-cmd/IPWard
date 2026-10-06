import type { AdSighting, CaptureSession, PrivacyDataset } from '../types';

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
  const headings = ['id', 'timestamp_utc', 'first_contact_utc', 'data_mode', 'source', 'app', 'app_id', 'domain', 'ip', 'organization', 'country', 'category', 'classification_source', 'classification_confidence', 'classification_explanation', 'uploaded_bytes', 'downloaded_bytes', 'reported_contacts', 'apple_potential_cross_app_flag', 'foreground_state', 'evidence_state', 'confidence', 'evidence_explanation'];
  const appNames = new Map(dataset.apps.map(app => [app.id, app.name]));
  const organizationNames = new Map(dataset.organizations.map(organization => [organization.id, organization.name]));
  const rows = dataset.connections.map(event => [
    event.id, new Date(event.timestamp).toISOString(), event.reportFirstAt ? new Date(event.reportFirstAt).toISOString() : null, event.source === 'demo' ? 'demo' : 'device', event.source,
    appNames.get(event.appId ?? '') ?? 'Unattributed', event.appId, event.domain, event.ip,
    organizationNames.get(event.organizationId ?? '') ?? 'Unknown organization', event.country, event.category, event.classification.source, event.classification.confidence, event.classification.explanation,
    event.bytesMeasured === false ? null : event.bytesUploaded, event.bytesMeasured === false ? null : event.bytesDownloaded, event.reportHits ?? null, event.potentialTracker === undefined ? null : event.potentialTracker ? 'true' : 'false', event.foregroundState, event.provenance.state,
    event.provenance.confidence, event.provenance.explanation,
  ]);
  return [headings, ...rows].map(row => row.map(encodeCsvCell).join(',')).join('\r\n');
}

export function createActivityReport(dataset: PrivacyDataset, captures: readonly CaptureSession[], range: string, now = Date.now(), adSightings: readonly AdSighting[] = []): string {
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
      'Apple domain rows may show first and latest contact times. Intermediate contact times and their relation to sensor accesses are unknown.',
      'A near-time access and domain contact do not prove that accessed data was sent or used for advertising.',
      'Ad sightings are notes entered by the user. They are not detected ad impressions and do not establish targeting causation.',
    ],
    dataset,
    captures,
    adSightings,
  }, null, 2);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

export function createActivityReportHtml(dataset: PrivacyDataset, range: string, now = Date.now()): string {
  const appNames = new Map(dataset.apps.map(app => [app.id, app.name]));
  const organizationNames = new Map(dataset.organizations.map(organization => [organization.id, organization.name]));
  const totalContacts = dataset.connections.reduce((sum, event) => sum + (event.reportHits ?? 1), 0);
  const flagged = dataset.connections.filter(event => event.potentialTracker || ['Advertising', 'Analytics', 'Attribution', 'Marketing'].includes(event.category));
  const rows = dataset.connections.slice(0, 250).map(event => `<tr><td>${escapeHtml(new Date(event.timestamp).toLocaleString())}</td><td>${escapeHtml(appNames.get(event.appId ?? '') ?? 'Unattributed')}</td><td>${escapeHtml(event.domain)}</td><td>${escapeHtml(organizationNames.get(event.organizationId ?? '') ?? 'Unknown')}</td><td>${escapeHtml(event.category)}</td><td>${escapeHtml(event.reportHits ?? 1)}</td><td>${escapeHtml(event.provenance.state)}</td></tr>`).join('');
  const accessRows = dataset.sensors.slice(0, 150).map(event => `<tr><td>${escapeHtml(new Date(event.timestamp).toLocaleString())}</td><td>${escapeHtml(appNames.get(event.appId ?? '') ?? 'Unattributed')}</td><td>${escapeHtml(event.sensor)}</td><td>${escapeHtml(Math.max(1, Math.round((event.timestampEnd - event.timestamp) / 1000)))} sec</td><td>${escapeHtml(event.provenance.state)}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@page{margin:32px}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#182329;font-size:10px;line-height:1.45}h1{font-size:25px;margin:0}h2{font-size:15px;margin:24px 0 7px}.muted{color:#52636b}.notice{background:#eef4ef;border:1px solid #cad8cd;border-radius:9px;padding:10px;margin:12px 0}.metrics{display:flex;gap:8px;flex-wrap:wrap}.metric{border:1px solid #ccd5d2;border-radius:9px;padding:10px;min-width:110px}.metric b{display:block;font-size:19px;color:#08752d}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #dfe5e2;padding:6px 4px;word-break:break-word}th{font-size:8px;text-transform:uppercase;color:#52636b}.footer{margin-top:24px;padding-top:8px;border-top:1px solid #ccd5d2;color:#52636b}</style></head><body><h1>IPward privacy report</h1><div class="muted">${escapeHtml(range)} · generated ${escapeHtml(new Date(now).toLocaleString())} · ${dataset.mode === 'demo' ? 'Illustrative sample workspace' : 'Device workspace / loaded local evidence'}</div><div class="notice"><b>Read this first:</b> This report describes evidence available inside IPward. A domain contact does not reveal payload contents or prove storage. Missing findings do not establish that a device is safe or spyware-free.</div><div class="metrics"><div class="metric"><b>${dataset.apps.length}</b>apps in scope</div><div class="metric"><b>${dataset.connections.length}</b>destination records</div><div class="metric"><b>${totalContacts}</b>reported contacts</div><div class="metric"><b>${flagged.length}</b>tracker-related rows</div><div class="metric"><b>${dataset.sensors.length}</b>access intervals</div></div><h2>Network destinations</h2><table><thead><tr><th>Latest time</th><th>App</th><th>Domain</th><th>Provider</th><th>Category</th><th>Contacts</th><th>Evidence</th></tr></thead><tbody>${rows || '<tr><td colspan="7">No network destination records in this report.</td></tr>'}</tbody></table>${dataset.connections.length > 250 ? `<p class="muted">Showing the first 250 of ${dataset.connections.length} rows. Use JSON or CSV for the complete machine-readable export.</p>` : ''}<h2>Resource access</h2><table><thead><tr><th>Start</th><th>App</th><th>Resource</th><th>Duration</th><th>Evidence</th></tr></thead><tbody>${accessRows || '<tr><td colspan="5">No resource-access intervals in this report.</td></tr>'}</tbody></table>${dataset.sensors.length > 150 ? `<p class="muted">Showing the first 150 of ${dataset.sensors.length} intervals.</p>` : ''}<div class="footer">Generated locally by IPward. Imported Apple report rows are historical aggregates, not live packet captures. Endpoint location does not establish where personal information is stored.</div></body></html>`;
}
