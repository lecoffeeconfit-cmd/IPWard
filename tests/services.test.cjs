const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = name => require(path.join(process.env.IPWARD_TEST_BUILD, name));
const { classifyDomain } = load('services/classifier.js');
const { getDestinationInsight } = load('services/destinationInsight.js');
const { getCapabilities, canMonitorDevice } = load('services/capabilities.js');
const { filterByRange, filterConnections, getOverview, summarizeConnections, getRangeInterval } = load('services/analytics.js');
const { estimateCommunicationActivity } = load('services/estimation.js');
const { createDemoDataset, createEmptyDataset } = load('data/demo.js');
const { createCapture, createImportedSnapshot, updateCapture, finishCapture, compareCaptures, exportCaptureCSV, exportCaptureJSON } = load('services/capture.js');
const { createLocalStore, createMemoryStorage, isStoredCapture, isStoredAdSighting } = load('services/storage.js');
const { createActivityReport, createActivityReportHtml, createConnectionCsv } = load('utils/export.js');
const { estimateTimingClue } = load('services/privacyInference.js');
const { summarizeModalities, resourceMeaning } = load('services/modalityInsights.js');
const { getBehaviorInsights } = load('services/behaviorInsights.js');
const { createNetworkRule, evaluateNetworkRules, isStoredNetworkRule, normalizeRuleValue } = load('services/networkRules.js');
const { parseLocalReputationList, isStoredLocalReputation } = load('services/localReputation.js');
const { parseDataFootprintExport, isStoredDataFootprint } = load('services/dataFootprint.js');
const { getPrivacyScores, getAppPrivacyScore } = load('services/privacyScores.js');
const { analyzeWebAddress } = load('services/webPrivacy.js');
const { parseSecurityIndicators, isStoredSecurityIndicators } = load('services/securityIndicators.js');
const { buildSecurityReview } = load('services/securityScan.js');
const { parseCompanionReport, companionEvidence, evidencePriority, newIntegritySession, isIntegritySession, reviewEvidence, timingEvidence, waitForForeground } = load('services/integrityScan.js');
const { comparePerformanceRun, isStoredPerformanceRun, runPerformanceProbe } = load('services/performanceProbe.js');
const { CONNECTION_TEST_SIZES, isStoredConnectionTest, runConnectionTest } = load('services/connectionTest.js');
const { parseApplePrivacyReport } = load('services/appleReport.js');
const { normalizeAndroidUsage } = load('services/androidUsageCore.js');
const { mergeImportedDatasets, emptyImportedDataset } = load('services/eventStore.types.js');
const now = new Date(2026, 8, 30, 18, 0, 0).getTime();
const dataset = createDemoDataset(now);

test('integrity reports validate a strict companion contract and never promote an unverified family claim', () => {
  const report = { schemaVersion: 1, type: 'ipward-companion-result', generatedAt: Date.now(), toolName: 'Local test tool', inputKind: 'encrypted-ios-backup', artifacts: [
    { id: 'artifact-1', category: 'network', observedAt: Date.now() - 1000, summary: 'An exact address was found in backup history', sourcePath: 'backup/network.db', indicator: 'example.test', family: 'Pegasus' },
  ], warnings: [] };
  const parsed = parseCompanionReport(JSON.stringify(report));
  const evidence = companionEvidence(parsed);
  assert.equal(evidence[0].strength, 'context');
  assert.match(evidence[0].detail, /unverified/);
  assert.equal(evidencePriority(evidence).score, 4);
  const matched = companionEvidence(parsed, { name: 'test', importedAt: Date.now(), source: 'user-import', domains: ['example.test'], ips: [], appIds: [], skipped: 0 });
  assert.equal(matched[0].strength, 'review');
  assert.throws(() => parseCompanionReport(JSON.stringify({ ...report, artifacts: [report.artifacts[0], report.artifacts[0]] })), /malformed|duplicated/);
  assert.throws(() => parseCompanionReport(JSON.stringify({ ...report, schemaVersion: 2 })), /Unsupported/);
  assert.throws(() => parseCompanionReport('not json'), /valid JSON/);
});

test('timing-only clues have low review priority and sample data never becomes device evidence', () => {
  const session = newIntegritySession('quick', 'unsure', false, undefined, Date.now());
  assert.ok(isIntegritySession(session));
  assert.equal(isIntegritySession({ ...session, evidence: new Array(1201).fill({}) }), false);
  const run = { version: 1, id: '4-abcd', recordedAt: Date.now(), platform: 'ios', development: false, controlled: true, timerMedianMs: 100, timerP95Ms: 100, lateFramePercent: 75, workMedianMs: 15, durationMs: 1000 };
  const evidence = timingEvidence([run], []);
  assert.equal(evidence[0].strength, 'context');
  assert.ok(evidencePriority(evidence).score <= 20);
  assert.deepEqual(reviewEvidence(buildSecurityReview(dataset, 'demo', null, null, now)), []);
});

test('foreground scan phases stop on cancellation or app departure', async () => {
  const cancelled = new AbortController();
  const pending = waitForForeground(5000, cancelled.signal, () => true);
  cancelled.abort();
  await assert.rejects(pending, /cancelled/);
  await assert.rejects(waitForForeground(5000, new AbortController().signal, () => false), /interrupted/);
});

test('internet test uses only the selected bounded payload and records real response sizes', async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/__down?bytes=')) {
      const bytes = Number(new URL(url).searchParams.get('bytes'));
      return new Response(new Uint8Array(bytes));
    }
    assert.equal(url, 'https://speed.cloudflare.com/__up');
    assert.equal(options.method, 'POST');
    assert.equal(options.body.length, CONNECTION_TEST_SIZES.quick.upload);
    return new Response('ok');
  };
  const progress = [];
  const result = await runConnectionTest('quick', 'WIFI', new AbortController().signal, value => progress.push(value), request);
  assert.equal(calls.length, 5);
  assert.equal(calls.filter(call => call.url.endsWith('bytes=0')).length, 3);
  assert.equal(result.downloadedBytes, 250_000);
  assert.equal(result.uploadedBytes, 100_000);
  assert.equal(result.link, 'WIFI');
  assert.ok(result.downloadMbps >= 0 && result.uploadMbps >= 0);
  assert.equal(progress.at(-1), 1);
  assert.ok(isStoredConnectionTest(result));
  assert.equal(isStoredConnectionTest({ ...result, downloadMbps: Infinity }), false);
});

test('internet test rejects an incomplete download and a cancelled run', async () => {
  const badDownload = async url => new Response(new Uint8Array(url.endsWith('bytes=0') ? 0 : 10));
  await assert.rejects(runConnectionTest('quick', 'WIFI', new AbortController().signal, undefined, badDownload), /incomplete/);
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(runConnectionTest('quick', 'WIFI', cancelled.signal), /cancelled/);
});

test('performance comparison needs comparable calm-condition runs and never returns a malware verdict', () => {
  const base = { version: 1, platform: 'ios', development: false, controlled: true, timerMedianMs: 3, timerP95Ms: 14, lateFramePercent: 4, workMedianMs: 5, durationMs: 1500 };
  const history = [1, 2, 3].map((day, index) => ({ ...base, id: `${day}-abc${index}`, recordedAt: day * 86400000 }));
  const current = { ...base, id: '4-abcd', recordedAt: 4 * 86400000 };
  assert.ok(isStoredPerformanceRun(current));
  assert.equal(comparePerformanceRun(current, history).state, 'usual');
  assert.equal(comparePerformanceRun({ ...current, timerP95Ms: 100 }, history).state, 'mixed');
  assert.equal(comparePerformanceRun({ ...current, timerP95Ms: 100, workMedianMs: 15, lateFramePercent: 75 }, history).state, 'slower');
  assert.equal(comparePerformanceRun({ ...current, controlled: false }, history).state, 'conditions');
  assert.equal(comparePerformanceRun({ ...current, platform: 'web' }, history).state, 'conditions');
  assert.equal(comparePerformanceRun(current, history.slice(0, 2)).state, 'baseline');
  assert.equal(isStoredPerformanceRun({ ...current, timerP95Ms: Number.POSITIVE_INFINITY }), false);
});

test('performance probe aborts when the app is not active', async () => {
  await assert.rejects(runPerformanceProbe('ios', false, true, () => false), /foreground/);
});

test('performance probe records bounded local timings and completes all phases', async () => {
  const originalFrame = global.requestAnimationFrame;
  const originalCancel = global.cancelAnimationFrame;
  global.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 4);
  global.cancelAnimationFrame = handle => clearTimeout(handle);
  try {
    let progress = 0;
    const run = await runPerformanceProbe('ios', false, true, () => true, value => { progress = value; });
    assert.ok(isStoredPerformanceRun(run));
    assert.equal(progress, 1);
    assert.ok(run.timerP95Ms >= run.timerMedianMs);
    assert.ok(run.durationMs >= 600);
  } finally {
    global.requestAnimationFrame = originalFrame;
    global.cancelAnimationFrame = originalCancel;
  }
});

test('security indicator import accepts only supported, unexpired exact STIX patterns', () => {
  const file = JSON.stringify({ type: 'bundle', objects: [
    { type: 'indicator', pattern: "[domain-name:value = 'WWW.GOOGLE-ANALYTICS.COM']" },
    { type: 'indicator', pattern: "[ipv4-addr:value = '203.0.113.1']" },
    { type: 'indicator', pattern: "[app:id = 'com.example.spy']" },
    { type: 'indicator', pattern: "[url:value = 'https://example.com/path']" },
    { type: 'indicator', pattern: "[domain-name:value = 'expired.example.com']", valid_until: '2020-01-01T00:00:00Z' },
    { type: 'indicator', pattern: "[domain-name:value = 'revoked.example.com']", revoked: true },
  ] });
  const result = parseSecurityIndicators(file, 'local.stix2', now);
  assert.deepEqual(result.domains, ['www.google-analytics.com']);
  assert.deepEqual(result.ips, ['203.0.113.1']);
  assert.deepEqual(result.appIds, ['com.example.spy']);
  assert.equal(result.skipped, 3);
  assert.ok(isStoredSecurityIndicators(result));
  assert.throws(() => parseSecurityIndicators(JSON.stringify({ type: 'bundle', objects: [{ type: 'indicator', pattern: "[file:name = 'spy.exe']" }] }), 'bad', now));
});

test('security review separates user-supplied matches from behavior and never marks unavailable checks as passed', () => {
  const matching = dataset.connections.find(event => event.domain === 'www.google-analytics.com');
  assert.ok(matching);
  const set = parseSecurityIndicators(JSON.stringify({ type: 'bundle', objects: [{ type: 'indicator', pattern: "[domain-name:value = 'www.google-analytics.com']" }] }), 'user supplied', now);
  const review = buildSecurityReview(dataset, 'demo', set, null, now);
  assert.equal(review.sample, true);
  assert.ok(review.findings.some(item => item.kind === 'indicator' && item.domain === matching.domain && item.source === 'user supplied'));
  assert.equal(review.checks.find(item => item.id === 'integrity').status, 'device-only');
  assert.equal(review.checks.find(item => item.id === 'forensics').status, 'desktop-only');
  const empty = buildSecurityReview(createEmptyDataset(now), 'device', null, null, now);
  assert.equal(empty.findings.length, 0);
  assert.equal(empty.checks.find(item => item.id === 'history').status, 'needs-data');
});

test('aggregate report hits are not treated as repeated background connections', () => {
  const report = parseApplePrivacyReport(JSON.stringify({ type: 'networkActivity', domain: 'odd.example.com', bundleID: 'com.example.app', timeStamp: '2026-09-30T10:03:00Z', hits: 187 }));
  const review = buildSecurityReview(report.dataset, 'device', null, null, now);
  assert.equal(review.findings.some(item => item.kind === 'pattern'), false);
  assert.equal(review.checks.find(item => item.id === 'baseline').status, 'needs-data');
});

test('security review calls out encoded DNS shapes and large background transfers without a malware verdict', () => {
  const base = dataset.connections[0];
  const suspicious = { ...base, id: 'heuristic-test', source: 'vpn-service', timestamp: now - 1000, domain: 'x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1.example.com', foregroundState: 'background', bytesMeasured: true, bytesUploaded: 15_000_000 };
  const review = buildSecurityReview({ ...dataset, connections: [suspicious] }, 'device', null, null, now);
  assert.ok(review.findings.some(item => item.title === 'Unusual DNS name shape'));
  assert.ok(review.findings.some(item => item.title === 'Large background upload'));
  assert.ok(review.findings.every(item => !/spyware detected|malware detected/i.test(item.detail)));
});

test('modality view keeps each app’s access and contacts separate and caps recent clues at ten', () => {
  const report = parseApplePrivacyReport([
    { type: 'networkActivity', domain: 'ads.example.com', bundleID: 'com.example.instagram', timeStamp: '2026-09-29T10:03:00Z', hits: 99, domainType: 1 },
    { type: 'access', accessor: { identifier: 'com.example.instagram' }, category: 'microphone', identifier: 'mic', kind: 'intervalBegin', timeStamp: '2026-09-29T10:00:00Z' },
    { type: 'access', accessor: { identifier: 'com.example.instagram' }, category: 'microphone', identifier: 'mic', kind: 'intervalEnd', timeStamp: '2026-09-29T10:01:00Z' },
    { type: 'networkActivity', domain: 'other.example.com', bundleID: 'com.example.other', timeStamp: '2026-09-29T10:04:00Z', hits: 2 },
  ].map(row => JSON.stringify(row)).join('\n'));
  const instagramId = report.dataset.apps.find(app => app.identifier === 'com.example.instagram').id;
  const summary = summarizeModalities(instagramId, report.dataset.sensors, report.dataset.connections);
  assert.equal(summary.microphoneAccesses, 1);
  assert.equal(summary.domainContacts, 1);
  assert.equal(summary.recent.length, 2);
  assert.equal(summary.recent[0].kind, 'contact');
  assert.ok(summary.recent.every(item => item.event.appId === instagramId));
  assert.equal(summarizeModalities(instagramId, report.dataset.sensors, report.dataset.connections, 1).recent.length, 1);
  assert.match(resourceMeaning('Microphone'), /words are unavailable/i);
});

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
  assert.equal(report.dataset.connections[0].reportFirstAt, Date.parse('2026-09-28T10:00:00Z'));
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
  assert.match(exportCaptureCSV(snapshot), /first_contact_utc/);
  assert.match(createConnectionCsv(report.dataset), /2026-09-28T10:00:00.000Z/);
  assert.ok(!exportCaptureCSV(snapshot).includes('"0","0","10"'));
});

test('timing clues compare only same-app imported access near the latest flagged contact', () => {
  const report = parseApplePrivacyReport([
    { type: 'networkActivity', domain: 'tracker.example', bundleID: 'com.example.chat', firstTimeStamp: '2026-09-28T10:00:00Z', timeStamp: '2026-09-29T10:00:00Z', hits: 5, domainType: 1 },
    { type: 'access', accessor: { identifier: 'com.example.chat' }, category: 'microphone', identifier: 'a', kind: 'intervalBegin', timeStamp: '2026-09-29T09:52:00Z' },
    { type: 'access', accessor: { identifier: 'com.example.chat' }, category: 'microphone', identifier: 'a', kind: 'intervalEnd', timeStamp: '2026-09-29T09:53:00Z' },
    { type: 'access', accessor: { identifier: 'com.example.other' }, category: 'camera', identifier: 'b', kind: 'intervalBegin', timeStamp: '2026-09-29T09:59:00Z' },
    { type: 'access', accessor: { identifier: 'com.example.other' }, category: 'camera', identifier: 'b', kind: 'intervalEnd', timeStamp: '2026-09-29T10:01:00Z' },
  ].map(row => JSON.stringify(row)).join('\n'));
  const contact = report.dataset.connections[0];
  const clue = estimateTimingClue(contact, report.dataset.sensors);
  assert.equal(clue.sensor.sensor, 'Microphone');
  assert.equal(clue.gapMs, 7 * 60_000);
  assert.equal(clue.relation, 'before');
  assert.equal(clue.confidence, 'low');
  assert.equal(estimateTimingClue(contact, report.dataset.sensors, 5 * 60_000), null);
  assert.equal(estimateTimingClue({ ...contact, potentialTracker: false }, report.dataset.sensors), null);
  assert.equal(estimateTimingClue({ ...contact, source: 'demo' }, report.dataset.sensors), null);
  assert.equal(isStoredCapture({ ...createImportedSnapshot(report.dataset, null, 'Snapshot'), connections: [{ ...contact, reportFirstAt: contact.timestamp + 1000 }] }), false);
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

test('destination explanations keep endpoint regions and inferred purposes separate', () => {
  const sample = dataset.connections.find(event => event.category === 'CDN' && event.countryCode);
  assert.ok(sample);
  const sampleInsight = getDestinationInsight(sample);
  assert.equal(sampleInsight.locationState, 'Estimated');
  assert.match(sampleInsight.location, /, /);
  assert.equal(sampleInsight.role, 'Content delivery edge');
  assert.equal(sampleInsight.roleState, 'Estimated');
  assert.match(sampleInsight.facility, /could be/i);

  const report = parseApplePrivacyReport(JSON.stringify({ type: 'networkActivity', domain: 'events.appsflyer.com', bundleID: 'com.example.app', timeStamp: '2026-09-29T10:00:00Z', hits: 2, domainOwner: 'AppsFlyer' }));
  const imported = getDestinationInsight(report.dataset.connections[0]);
  assert.equal(imported.location, 'Location unavailable');
  assert.equal(imported.locationState, 'Unavailable');
  assert.equal(imported.role, 'Attribution service');
  assert.equal(imported.roleState, 'Estimated');
  assert.match(imported.locationExplanation, /no IP address/i);

  const unknown = getDestinationInsight({ ...report.dataset.connections[0], classification: { ...report.dataset.connections[0].classification, source: 'unknown' } });
  assert.equal(unknown.roleState, 'Unavailable');
  assert.equal(unknown.purpose, 'Purpose unavailable');
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
    assert.equal(getCapabilities(platform, 'device', false, false).threatIntelligence.available, false);
    assert.equal(getCapabilities(platform, 'device', false, true).threatIntelligence.available, true);
  }
  assert.equal(getCapabilities('android', 'device', true).deviceActivity.available, true);
  assert.equal(getCapabilities('ios', 'device', true).deviceActivity.available, false);
});

test('fixtures are deterministic, fully attributed as demo, and have coherent derived metrics', () => {
  assert.deepEqual(createDemoDataset(now), dataset);
  assert.ok([...dataset.connections, ...dataset.sensors, ...dataset.communications].every(event => event.source === 'demo' && event.provenance.source === 'demo' && event.timestamp <= now));
  const overview = getOverview(dataset, 'Today', now);
  assert.equal(overview.connections, 318);
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

test('behavior insights compare only event-level local observations and retain uncertainty', () => {
  const insight = getBehaviorInsights(dataset.connections, dataset.apps, 'demo', now);
  assert.equal(insight.status, 'ready');
  assert.equal(insight.sample, true);
  assert.ok(insight.appBaselines.some(item => item.appId === 'instagram' && item.observedDays === 7));
  assert.ok(insight.findings.some(item => item.type === 'new-destination' && item.domain === 'sync-edge.example'));
  assert.ok(insight.findings.every(item => item.confidence === 'low' && item.evidenceDays >= 3));

  const imported = dataset.connections.map(event => ({ ...event, source: 'user-import' }));
  const reportResult = getBehaviorInsights(imported, dataset.apps, 'device', now);
  assert.equal(reportResult.status, 'unavailable');
  assert.match(reportResult.reason, /rolling aggregates/);

  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const shortHistory = dataset.connections.filter(event => event.timestamp >= todayStart.getTime() - 86_400_000);
  assert.equal(getBehaviorInsights(shortHistory, dataset.apps, 'demo', now).status, 'waiting');
});

test('local network rules normalize targets and prioritize specificity without claiming enforcement', () => {
  assert.equal(normalizeRuleValue('domain', ' ADS.Example.com. '), 'ads.example.com');
  assert.equal(normalizeRuleValue('ip', '203.0.113.42'), '203.0.113.42');
  assert.equal(normalizeRuleValue('ip', '256.0.0.1'), null);
  assert.equal(normalizeRuleValue('ip-range', '203.0.113.19/24'), '203.0.113.0/24');
  assert.equal(normalizeRuleValue('ip-range', '203.0.113.0/33'), null);
  assert.equal(normalizeRuleValue('asn', 'as15169'), 'AS15169');
  assert.equal(normalizeRuleValue('country', 'us'), 'US');
  assert.equal(normalizeRuleValue('category', 'Advertising'), 'advertising');
  assert.equal(normalizeRuleValue('organization', 'org-google'), 'org-google');

  const event = { ...dataset.connections[0], domain: 'api.example.com', ip: '203.0.113.42', countryCode: 'US', asn: 'AS15169', organizationId: 'org-google', category: 'Advertising' };
  const countryBlock = createNetworkRule('block', 'country', 'US', 1);
  const rangeAlert = createNetworkRule('alert', 'ip-range', '203.0.113.0/24', 2);
  const domainAllow = createNetworkRule('allow', 'domain', 'api.example.com', 3);
  assert.ok(countryBlock && rangeAlert && domainAllow);
  assert.equal(evaluateNetworkRules(event, [countryBlock, rangeAlert])?.action, 'alert');
  assert.equal(evaluateNetworkRules(event, [countryBlock, rangeAlert, domainAllow])?.action, 'allow');
  assert.equal(isStoredNetworkRule(domainAllow), true);
  assert.equal(isStoredNetworkRule({ ...domainAllow, value: 'https://api.example.com' }), false);
  const categoryRule = createNetworkRule('alert', 'category', event.category, 4);
  const organizationRule = createNetworkRule('block', 'organization', event.organizationId, 5);
  const temporary = createNetworkRule('block', 'domain', event.domain, 6, 1000);
  assert.equal(evaluateNetworkRules(event, [categoryRule], 10)?.id, categoryRule.id);
  assert.equal(evaluateNetworkRules(event, [organizationRule], 10)?.id, organizationRule.id);
  assert.equal(evaluateNetworkRules(event, [temporary], 500)?.id, temporary.id);
  assert.equal(evaluateNetworkRules(event, [temporary], 1007), null);
});

test('account export inventory retains categories and field paths without retaining personal values', () => {
  const exported = JSON.stringify({ profile: { email: 'person@example.com', name: 'Person' }, location_history: [{ latitude: 1, longitude: 2 }], searches: [{ query: 'private words' }], advertising_interests: ['travel'] });
  const result = parseDataFootprintExport(exported, 'google-takeout.json', now);
  assert.equal(result.provider, 'Google');
  assert.equal(result.source, 'user-export');
  assert.ok(result.categories.some(item => item.category === 'Identity & account'));
  assert.ok(result.categories.some(item => item.category === 'Location'));
  assert.ok(result.categories.some(item => item.category === 'Browsing & search'));
  assert.equal(JSON.stringify(result).includes('person@example.com'), false);
  assert.equal(JSON.stringify(result).includes('private words'), false);
  assert.equal(isStoredDataFootprint(result), true);
  assert.throws(() => parseDataFootprintExport('not valid structured data', 'bad.txt', now), /valid JSON, NDJSON, or CSV/);
});

test('web privacy review is local, strips tracking parameters, and preserves uncertainty', () => {
  const list = { name: 'local.txt', importedAt: now, source: 'user-import', domains: ['example.com'] };
  const review = analyzeWebAddress('http://example.com/path?utm_source=test&redirect=https%3A%2F%2Fother.example', list);
  assert.equal(review.domain, 'example.com');
  assert.equal(review.localListMatch, true);
  assert.equal(review.sanitizedUrl.includes('utm_source'), false);
  assert.ok(review.findings.some(item => item.id === 'http'));
  assert.ok(review.findings.some(item => item.id === 'redirect'));
  assert.ok(review.reviewPriority > 40);
  assert.throws(() => analyzeWebAddress('javascript:alert(1)'), /Only HTTP and HTTPS/);
});

test('privacy scores remain exposure summaries and leave missing app evidence blank', () => {
  const scores = getPrivacyScores(dataset);
  assert.ok(scores.overall.score >= 0 && scores.overall.score <= 100);
  assert.match(scores.overall.detail, /not a device safety grade/i);
  assert.ok(getAppPrivacyScore(dataset, 'instagram').score !== null);
  const empty = createEmptyDataset(now);
  assert.equal(getPrivacyScores(empty).overall.score, null);
  assert.equal(getAppPrivacyScore({ ...empty, apps: [{ id: 'empty', identifier: 'empty', name: 'Empty', initials: 'E', color: '#000', icon: 'grid', category: 'Other', permissions: [], source: 'user-import' }] }, 'empty').score, null);
});

test('local reputation lists parse hosts and plain-domain files without treating their labels as verified', () => {
  const parsed = parseLocalReputationList('\uFEFF# user file\n127.0.0.1 Ads.Example.com tracker.example.com\nmetrics.example.net\n! commented rule\ninvalid/path\n');
  assert.deepEqual(parsed.domains, ['ads.example.com', 'metrics.example.net', 'tracker.example.com']);
  assert.equal(parsed.skipped, 1);
  const saved = { name: 'local.txt', importedAt: now, source: 'user-import', domains: parsed.domains };
  assert.equal(isStoredLocalReputation(saved), true);
  assert.equal(isStoredLocalReputation({ ...saved, source: 'verified-feed' }), false);
  assert.throws(() => parseLocalReputationList(' # empty list\n'), /No valid domains/);
  assert.throws(() => parseLocalReputationList('x'.repeat(5_000_001)), /5 MB/);
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
  const unsafe = { ...dataset, apps: dataset.apps.map((app, index) => index ? app : { ...app, name: '<script>alert(1)</script>' }) };
  const html = createActivityReportHtml(unsafe, 'Today', now);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('user-entered ad notes retain provenance in storage and JSON exports', () => {
  const sighting = { id: 'ad-note-test', observedAt: now, appName: 'Example app', wording: 'Example offer', source: 'user-note' };
  assert.equal(isStoredAdSighting(sighting), true);
  assert.equal(isStoredAdSighting({ ...sighting, source: 'auto-detected' }), false);
  assert.equal(isStoredAdSighting({ ...sighting, wording: '  ' }), false);
  assert.equal(isStoredAdSighting({ ...sighting, appName: 'x'.repeat(81) }), false);
  assert.equal(isStoredAdSighting({ ...sighting, recalledOrigin: 'spoken', topics: ['coffee', 'running shoes'] }), true);
  assert.equal(isStoredAdSighting({ ...sighting, recalledOrigin: 'microphone-detected' }), false);
  assert.equal(isStoredAdSighting({ ...sighting, topics: Array(11).fill('word') }), false);
  const exported = JSON.parse(createActivityReport(dataset, [], 'Today', now, [sighting]));
  assert.deepEqual(exported.adSightings, [sighting]);
  assert.match(exported.limitations.join(' '), /not detected ad impressions/i);
  assert.match(exported.dataNotice, /Illustrative sample activity/);
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
