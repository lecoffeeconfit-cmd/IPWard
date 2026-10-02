const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = name => require(path.join(process.env.IPWARD_TEST_BUILD, name));
const { classifyDomain } = load('services/classifier.js');
const { getCapabilities, canMonitorDevice } = load('services/capabilities.js');
const { filterByRange, filterConnections, getOverview, summarizeConnections, getRangeInterval } = load('services/analytics.js');
const { estimateCommunicationActivity } = load('services/estimation.js');
const { createDemoDataset, createEmptyDataset } = load('data/demo.js');
const { createCapture, createImportedSnapshot, updateCapture, finishCapture, compareCaptures, exportCaptureCSV, exportCaptureJSON } = load('services/capture.js');
const { createLocalStore, createMemoryStorage, isStoredCapture } = load('services/storage.js');
const { parseApplePrivacyReport } = load('services/appleReport.js');
const { normalizeAndroidUsage } = load('services/androidUsageCore.js');
const { mergeImportedDatasets, emptyImportedDataset } = load('services/eventStore.types.js');
const now = new Date(2026, 8, 30, 18, 0, 0).getTime();
const dataset = createDemoDataset(now);

test('Apple report import preserves source, aggregate hits, access intervals, and unknown transfer data', () => {
  const rows = [
    { type: 'networkActivity', domain: 'api.example.com', bundleID: 'com.example.chat', firstTimeStamp: '2026-09-28T10:00:00Z', timeStamp: '2026-09-29T10:00:00Z', hits: 10, domainType: 1, domainOwner: 'Example Inc.' },
    { type: 'access', accessor: { identifier: 'com.example.chat', identifierType: 'bundleID' }, category: 'microphone', identifier: 'interval-1', kind: 'intervalBegin', timeStamp: '2026-09-29T10:01:00Z' },
    { type: 'access', accessor: { identifier: 'com.example.chat', identifierType: 'bundleID' }, category: 'microphone', identifier: 'interval-1', kind: 'intervalEnd', timeStamp: '2026-09-29T10:01:13Z' },
    { type: 'networkActivity', domain: 'not a domain', bundleID: 'com.example.chat', timeStamp: '2026-09-29T10:00:00Z' },
  ];
  const report = parseApplePrivacyReport(rows.map(row => JSON.stringify(row)).join('\n'));
  assert.equal(report.networkRecords, 1);
  assert.equal(report.totalContacts, 10);
  assert.equal(report.sensorIntervals, 1);
  assert.equal(report.skipped, 1);
  assert.equal(report.dataset.connections[0].bytesMeasured, false);
  assert.equal(report.dataset.connections[0].potentialTracker, true);
  assert.equal(report.dataset.connections[0].provenance.source, 'user-import');
  assert.equal(report.dataset.connections[0].foregroundState, 'unknown');
  assert.equal(report.dataset.sensors[0].timestampEnd - report.dataset.sensors[0].timestamp, 13_000);
  const merged = mergeImportedDatasets(emptyImportedDataset(), report.dataset, 0);
  assert.equal(mergeImportedDatasets(merged, report.dataset, 0).connections.length, 1);
  assert.equal(mergeImportedDatasets(merged, report.dataset, 0).sensors.length, 1);
  const snapshot = createImportedSnapshot(report.dataset, null, 'My Apple report');
  assert.equal(snapshot.kind, 'report-snapshot');
  assert.equal(isStoredCapture(snapshot), true);
  assert.match(exportCaptureJSON(snapshot), /historical-report-snapshot/);
  assert.match(exportCaptureCSV(snapshot), /reported_contacts/);
  assert.ok(!exportCaptureCSV(snapshot).includes('"0","0","10"'));
});

test('Apple import rejects unrelated files and does not convert incomplete sensor intervals into events', () => {
  assert.throws(() => parseApplePrivacyReport('{"hello":"world"}'), /no Apple App Privacy Report/i);
  const one = JSON.stringify({ type: 'access', accessor: { identifier: 'com.example.app' }, category: 'camera', identifier: 'only-begin', kind: 'intervalBegin', timeStamp: '2026-09-29T10:00:00Z' });
  const report = parseApplePrivacyReport(one);
  assert.equal(report.sensorIntervals, 0);
  assert.equal(report.skipped, 1);
});

test('Android usage normalization keeps OS day buckets and rejects malformed or impossible totals', () => {
  const day = new Date(2026, 8, 29).getTime();
  const rows = [
    { packageName: 'com.example.chat', label: 'Chat', bucketStart: day + 3600_000, bucketEnd: day + 7200_000, foregroundMs: 120_000, lastTimeUsed: day + 7200_000 },
    { packageName: 'com.example.chat', label: 'Chat', bucketStart: day + 7200_000, bucketEnd: day + 10800_000, foregroundMs: 60_000, lastTimeUsed: day + 10800_000 },
    { packageName: 'bad/package', label: 'Invalid', bucketStart: day, bucketEnd: day, foregroundMs: 9000, lastTimeUsed: day },
    { packageName: 'com.example.other', label: 'Other', bucketStart: day, bucketEnd: day, foregroundMs: 90_000_000, lastTimeUsed: day },
  ];
  const result = normalizeAndroidUsage(rows, day, day + 86_000_000);
  assert.equal(result.apps.length, 1);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].durationSeconds, 180);
  assert.equal(result.records[0].source, 'device-activity');
  assert.equal(result.records[0].dayStart, day);
  assert.equal(result.records[0].lastTimeUsed, day + 10800_000);
});

test('endpoint classifier uses exact DNS label boundaries and endpoint-specific categories', () => {
  assert.deepEqual(classifyDomain('WWW.Google-Analytics.com.').categories, ['Analytics']);
  assert.deepEqual(classifyDomain('accounts.google.com').categories, ['Authentication']);
  for (const domain of ['evilgoogle-analytics.com', 'google-analytics.com.evil.test', 'https://google-analytics.com', 'x..google-analytics.com', 'google.com']) assert.deepEqual(classifyDomain(domain).categories, ['Unknown'], domain);
});

test('no platform can silently activate an unimplemented adapter or demo blocking', () => {
  for (const platform of ['ios', 'android', 'web']) {
    const caps = getCapabilities(platform, 'device');
    assert.equal(caps.appleReportImport.available, true);
    assert.ok(Object.entries(caps).filter(([key]) => key !== 'appleReportImport').every(([, capability]) => !capability.available));
    assert.equal(canMonitorDevice(caps), false);
    assert.equal(canMonitorDevice(getCapabilities(platform, 'demo')), false);
    assert.equal(getCapabilities(platform, 'demo').trackerBlocking.available, false);
    assert.equal(getCapabilities(platform, 'demo').smsExactCount.available, false);
  }
  assert.equal(getCapabilities('android', 'device', true).deviceActivity.available, true);
  assert.equal(getCapabilities('ios', 'device', true).deviceActivity.available, false);
});

test('fixtures are deterministic, fully attributed as demo, and have coherent derived metrics', () => {
  assert.deepEqual(createDemoDataset(now), dataset);
  assert.ok([...dataset.connections, ...dataset.sensors, ...dataset.communications].every(event => event.source === 'demo' && event.provenance.source === 'demo' && event.timestamp <= now));
  const overview = getOverview(dataset, 'Today', now);
  assert.equal(overview.connections, 317);
  assert.equal(overview.apps, 8);
  assert.equal(overview.sensorCounts.Microphone, 7);
  assert.equal(overview.sensorCounts.Camera, 3);
  assert.equal(overview.sensorCounts.Location, 34);
  assert.equal(overview.calls, 5);
  assert.equal(overview.emailsReceived, 43);
  assert.equal(overview.messageEstimate.value, null);
  assert.equal(getOverview(createEmptyDataset(now), 'Today', now).connections, 0);
  const today = filterConnections(dataset, { range: 'Today' }, now);
  assert.equal(overview.uploaded, today.reduce((sum, event) => sum + event.bytesUploaded, 0));
  assert.equal(summarizeConnections([]).organizations, 0);
});

test('calendar ranges separate midnight boundaries and exclude future observations', () => {
  const midnight = new Date(2026, 8, 30).getTime();
  const events = [{ timestamp: midnight - 1 }, { timestamp: midnight }, { timestamp: now }, { timestamp: now + 1 }];
  assert.deepEqual(filterByRange(events, 'Today', now).map(event => event.timestamp), [midnight, now]);
  assert.deepEqual(filterByRange(events, 'Yesterday', now).map(event => event.timestamp), [midnight - 1]);
  assert.equal(getRangeInterval('7 days', now).start, new Date(2026, 8, 24).getTime());
  assert.ok(filterConnections(dataset, { range: '7 days' }, now).length > filterConnections(dataset, { range: 'Yesterday' }, now).length);
});

test('connection filters compose app, background, endpoint class and search', () => {
  const events = filterConnections(dataset, { range: 'Today', appId: 'weather', backgroundOnly: true, category: 'Analytics', search: 'germany' }, now);
  assert.ok(events.length > 0);
  assert.ok(events.every(event => event.appId === 'weather' && event.foregroundState === 'background' && event.category === 'Analytics' && event.country === 'Germany'));
});

test('estimation refuses network-only, unauthorized, cross-app, and unavailable signals', () => {
  const signal = (type, extra = {}) => ({ id: type, type, appId: 'whatsapp', timestamp: now - 1000, authorized: true, source: 'demo', ...extra });
  const demo = getCapabilities('android', 'demo');
  assert.equal(estimateCommunicationActivity([signal('network-burst')], demo, now).value, null);
  assert.equal(estimateCommunicationActivity([signal('notification'), signal('app-usage', { authorized: false })], demo, now).value, null);
  assert.equal(estimateCommunicationActivity([signal('notification'), signal('app-usage', { appId: 'outlook' })], demo, now).value, null);
  assert.equal(estimateCommunicationActivity([signal('notification'), signal('app-usage')], getCapabilities('android', 'device'), now).value, null);
  const estimate = estimateCommunicationActivity([signal('notification'), signal('app-usage'), signal('network-burst')], demo, now);
  assert.equal(estimate.value, 1);
  assert.equal(estimate.unit, 'activity windows');
  assert.equal(estimate.state, 'Estimated');
  assert.equal(estimate.algorithmVersion, 'activity-windows/1.0.0');
  assert.equal(estimate.inputSignals.length, 3);
});

test('capture replay obeys elapsed time and source separation, with coherent comparison', () => {
  const start = createCapture('demo', 'instagram', now);
  assert.equal(updateCapture(start, dataset, now + 1000).connections.length, 0);
  const first = finishCapture(start, dataset, now + 10000);
  assert.equal(first.summary.connections, 5);
  assert.ok(first.connections.every(event => event.appId === 'instagram' && event.timestamp <= first.endedAt));
  assert.equal(first.summary.uploaded, first.connections.reduce((sum, event) => sum + event.bytesUploaded, 0));
  const later = finishCapture(createCapture('demo', 'instagram', now), dataset, now + 20000);
  assert.equal(compareCaptures(first, later).deltas.connections, 5);
  assert.equal(finishCapture(first, dataset, now + 30000), first);
  assert.throws(() => finishCapture(start, createEmptyDataset(now), now + 2000));
  assert.equal(updateCapture(createCapture('device', null, now), createEmptyDataset(now), now + 60000).connections.length, 0);
});

test('exports disclose demo provenance and neutralize spreadsheet formula injection', () => {
  const capture = finishCapture(createCapture('demo', null, now), dataset, now + 2000);
  const modified = { ...capture, connections: [{ ...capture.connections[0], domain: '=HYPERLINK("https://evil.example")' }] };
  assert.match(exportCaptureJSON(capture), /SAMPLE DATA/);
  assert.match(exportCaptureCSV(modified), /'=HYPERLINK/);
});

test('local persistence survives reload, validates nested data, and removes expired captures', async () => {
  const adapter = createMemoryStorage();
  const store = createLocalStore(adapter);
  const saved = finishCapture(createCapture('demo', null, now), dataset, now + 2000);
  await store.saveCaptures([saved]);
  assert.equal((await createLocalStore(adapter).loadCaptures(now + 3000))[0].id, saved.id);
  const invalid = { ...saved, connections: [{ ...saved.connections[0], bytesUploaded: -1 }] };
  assert.equal(isStoredCapture(invalid), false);
  assert.equal(isStoredCapture({ ...saved, mode: 'device' }), false);
  await adapter.setItem('ipward:captures:v1', JSON.stringify([saved, invalid]));
  assert.equal((await store.loadCaptures(now + 3000)).length, 1);
  assert.equal((await store.loadCaptures(now + 31 * 86400000)).length, 0);
  assert.equal(await adapter.getItem('ipward:captures:v1'), '[]');
  await adapter.setItem('ipward:preferences:v1', '{broken');
  assert.equal((await store.loadPreferences()).mode, 'demo');
  await store.deleteAllLocalData();
  assert.equal(await adapter.getItem('ipward:captures:v1'), null);
});
