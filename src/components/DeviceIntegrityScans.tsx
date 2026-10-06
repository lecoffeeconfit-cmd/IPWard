import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Platform, Pressable, Switch, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useKeepAwake } from 'expo-keep-awake';
import { Badge, Button, Card, Icon, IconName, InfoNote, Pill, SectionHeading, Txt } from './ui';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { buildSecurityReview } from '../services/securityScan';
import { isStoredSecurityIndicators, SecurityIndicatorSet } from '../services/securityIndicators';
import { isStoredPerformanceRun, PerformanceRun, runPerformanceProbe } from '../services/performanceProbe';
import { captureIntegrityEnvironment, QuickProgress, runQuickIntegrity } from '../services/integrityRuntime';
import { companionEvidence, evidencePriority, IntegrityEvidence, IntegrityKind, IntegritySession, isIntegritySession, MAX_COMPANION_BYTES, newIntegritySession, parseCompanionReport, reviewEvidence, ThreatNotice, timingEvidence } from '../services/integrityScan';

const sessionsKey = 'ipward.integritySessions.v1';
const indicatorsKey = 'ipward.securityIndicators.v1';
const performanceKey = 'ipward.performanceRuns.v1';
const scanChoices: { kind: IntegrityKind; title: string; subtitle: string; duration: string; icon: IconName; color: 'blue' | 'cyan' | 'purple' }[] = [
  { kind: 'quick', title: 'Quick Integrity Scan', subtitle: 'A controlled check of this phone, right now', duration: 'About 8–12 min · keep app open', icon: 'zap', color: 'blue' },
  { kind: 'extended', title: 'Extended Monitor', subtitle: 'Compare snapshots across a longer window', duration: '1, 6 or 24 hours · foreground samples', icon: 'activity', color: 'cyan' },
  { kind: 'deep', title: 'Deep Spyware Scan', subtitle: 'Review historical clues and companion evidence', duration: 'Guided · backup analysis needs a computer', icon: 'search', color: 'purple' },
];

function formatTime(timestamp: number) { return new Date(timestamp).toLocaleString(); }
function minutesLeft(timestamp: number, now: number) { return Math.max(0, Math.ceil((timestamp - now) / 60_000)); }

function PulsingDot({ color }: { color: string }) {
  const [opacity] = useState(() => new Animated.Value(0.35));
  useEffect(() => { const loop = Animated.loop(Animated.sequence([Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true })])); loop.start(); return () => loop.stop(); }, [opacity]);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity }} />;
}

function KeepAwakeDuringQuickScan() { useKeepAwake(); return null; }

function EvidenceRow({ item }: { item: IntegrityEvidence }) {
  const t = useTheme();
  const color = item.strength === 'strong-lead' ? t.red : item.strength === 'review' ? t.amber : t.cyan;
  return <View style={{ borderLeftWidth: 3, borderLeftColor: color, paddingLeft: 12, paddingVertical: 8, marginTop: 12 }}>
    <Txt size={13} weight="700">{item.title}</Txt>
    <Txt size={10} color={color} weight="700" style={{ marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.6 }}>{item.category} · {item.strength.replace('-', ' ')}</Txt>
    <Txt size={11} style={{ marginTop: 6 }}>{item.detail}</Txt>
    <Txt size={10} color={t.muted} style={{ marginTop: 5 }}>{formatTime(item.timestamp)} · {item.source}</Txt>
    <Txt size={10} color={t.muted} style={{ marginTop: 4 }}>{item.corroboration}</Txt>
  </View>;
}

export function DeviceIntegrityScans() {
  const t = useTheme();
  const { dataset, mode, localReputation, navigate } = useApp();
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<IntegritySession[]>([]);
  const sessionsRef = useRef<IntegritySession[]>([]);
  const [indicators, setIndicators] = useState<SecurityIndicatorSet | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceRun[]>([]);
  const [selected, setSelected] = useState<IntegrityKind | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<ThreatNotice>('unsure');
  const [controlled, setControlled] = useState(false);
  const [networkConsent, setNetworkConsent] = useState(false);
  const [hours, setHours] = useState<1 | 6 | 24>(24);
  const [progress, setProgress] = useState<QuickProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [clock, setClock] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const monitorSampling = useRef(false);
  const foregroundFocused = useRef(true);
  const mounted = useRef(true);
  const saving = useRef(Promise.resolve());

  const review = useMemo(() => buildSecurityReview(dataset, mode, indicators, localReputation, dataset.generatedAt), [dataset, mode, indicators, localReputation]);
  const active = sessions.find(item => item.id === activeId) ?? null;
  const runningExtended = sessions.find(item => item.kind === 'extended' && item.status === 'running') ?? null;

  const makeEvidence = useCallback((performance: PerformanceRun[] = [], noticeAnswer: ThreatNotice = notice) => {
    const imported = reviewEvidence(review);
    const timing = timingEvidence(performance, performanceHistory);
    const noticeEvidence: IntegrityEvidence[] = noticeAnswer === 'yes' ? [{ id: `notice-${Date.now()}`, category: 'context', title: 'Apple threat notification reported', detail: 'You reported receiving an Apple threat notification. This is an important targeting signal, but this answer alone does not prove current infection.', source: 'Your pre-scan answer', timestamp: Date.now(), strength: 'review', corroboration: 'Verify the notification directly at account.apple.com and seek expert guidance before erasing evidence.' }] : [];
    return [...noticeEvidence, ...imported, ...timing];
  }, [notice, performanceHistory, review]);

  function commit(session: IntegritySession) {
    const next = [session, ...sessionsRef.current.filter(item => item.id !== session.id)].sort((a, b) => b.startedAt - a.startedAt).slice(0, 20);
    sessionsRef.current = next;
    if (mounted.current) setSessions(next);
    saving.current = saving.current.then(() => AsyncStorage.setItem(sessionsKey, JSON.stringify(next))).catch(() => { if (mounted.current) setMessage('Scan history could not be saved locally.'); });
  }

  useEffect(() => {
    mounted.current = true;
    Promise.allSettled([AsyncStorage.getItem(sessionsKey), AsyncStorage.getItem(indicatorsKey), AsyncStorage.getItem(performanceKey)]).then(results => {
      if (!mounted.current) return;
      if (results[0].status === 'fulfilled' && results[0].value) {
        try {
          const parsed: unknown = JSON.parse(results[0].value);
          if (Array.isArray(parsed)) {
            const saved = parsed.filter(isIntegritySession).slice(0, 20).map(session => session.kind === 'quick' && session.status === 'running' ? { ...session, status: 'interrupted' as const, updatedAt: Date.now(), limitations: [...session.limitations, 'The app closed before the foreground scan finished.'] } : session);
            sessionsRef.current = saved;
            setSessions(saved);
            if (saved.some((item, index) => item !== parsed[index])) void AsyncStorage.setItem(sessionsKey, JSON.stringify(saved)).catch(() => setMessage('Interrupted scan state could not be saved.'));
          }
        } catch { setMessage('Saved scan history could not be read.'); }
      }
      if (results[1].status === 'fulfilled' && results[1].value) { try { const parsed: unknown = JSON.parse(results[1].value); if (isStoredSecurityIndicators(parsed)) setIndicators(parsed); } catch { /* Indicator comparison is optional. */ } }
      if (results[2].status === 'fulfilled' && results[2].value) { try { const parsed: unknown = JSON.parse(results[2].value); if (Array.isArray(parsed)) setPerformanceHistory(parsed.filter(isStoredPerformanceRun).slice(0, 12)); } catch { /* Timing baseline is optional. */ } }
      setReady(true);
    });
    return () => { mounted.current = false; abortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      foregroundFocused.current = state === 'active';
      if (state !== 'active') abortRef.current?.abort();
      else setClock(Date.now());
    });
    const blurred = Platform.OS === 'android' ? AppState.addEventListener('blur', () => { foregroundFocused.current = false; abortRef.current?.abort(); }) : null;
    const focused = Platform.OS === 'android' ? AppState.addEventListener('focus', () => { foregroundFocused.current = true; setClock(Date.now()); }) : null;
    const interval = setInterval(() => setClock(Date.now()), 60_000);
    return () => { subscription.remove(); blurred?.remove(); focused?.remove(); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!ready || !runningExtended || !runningExtended.environment || busy || monitorSampling.current || AppState.currentState !== 'active' || !foregroundFocused.current) return;
    const now = Date.now();
    if (runningExtended.endsAt && now >= runningExtended.endsAt) {
      commit({ ...runningExtended, status: 'completed', updatedAt: now, limitations: [...runningExtended.limitations, 'The app only sampled while open in the foreground. Gaps are not measurements.'] });
      return;
    }
    const last = runningExtended.snapshots[runningExtended.snapshots.length - 1]?.at ?? 0;
    if (now - last < 5 * 60_000) return;
    let live = true;
    monitorSampling.current = true;
    void (async () => {
      try {
        const snapshot = await captureIntegrityEnvironment();
        if (!live || !mounted.current || AppState.currentState !== 'active' || !foregroundFocused.current) return;
        let run: PerformanceRun | null = null;
        try {
          const comparable = runningExtended.controlled && Platform.OS !== 'web' && snapshot.lowPowerMode === false && snapshot.batteryPercent !== null && snapshot.batteryPercent >= 20;
          run = await runPerformanceProbe(Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web', __DEV__, comparable, () => live && mounted.current && AppState.currentState === 'active' && foregroundFocused.current);
        } catch { /* A condition snapshot can still be useful without a timing sample. */ }
        if (!live || !mounted.current || AppState.currentState !== 'active' || !foregroundFocused.current) return;
        const latest = sessionsRef.current.find(item => item.id === runningExtended.id);
        if (latest?.status !== 'running') return;
        const performance = run ? [...latest.performance, run].slice(-32) : latest.performance;
        commit({ ...latest, snapshots: [...latest.snapshots, snapshot].slice(-288), performance,
          evidence: makeEvidence(performance, latest.notice), updatedAt: snapshot.at,
          coverage: [...new Set([...latest.coverage, 'Automatic in-app timing samples while Protect remains open'])],
          limitations: run || latest.limitations.includes('Some foreground timing samples were unavailable.') ? latest.limitations : [...latest.limitations, 'Some foreground timing samples were unavailable.'] });
      } catch { if (live && mounted.current) setMessage('A monitor snapshot was unavailable.'); }
      finally { monitorSampling.current = false; }
    })();
    return () => { live = false; };
    // clock wakes this effect while the Protect page is visible; no background work is claimed.
  }, [busy, clock, makeEvidence, ready, runningExtended]);

  async function begin() {
    if (!ready || !selected || busy) return;
    setMessage(''); setProgress(null);
    if (selected === 'extended' && runningExtended) { setActiveId(runningExtended.id); setSelected(null); return; }
    const session = newIntegritySession(selected, notice, controlled, hours);
    setClock(session.startedAt);
    commit(session); setActiveId(session.id); setSelected(null);
    if (selected === 'deep') {
      try { commit({ ...session, environment: await captureIntegrityEnvironment(), evidence: makeEvidence([], session.notice), coverage: [mode === 'demo' ? 'Sample workspace excluded from device evidence' : 'Loaded network history and optional user-imported STIX2 indicators'], limitations: [...session.limitations, 'Full encrypted backup analysis requires a separate computer tool and a validated companion result.'] }); }
      catch { commit({ ...session, status: 'interrupted', updatedAt: Date.now(), limitations: [...session.limitations, 'Device conditions were unavailable.'] }); }
      return;
    }
    if (selected === 'extended') {
      try { const snapshot = await captureIntegrityEnvironment();
        commit({ ...session, environment: snapshot, snapshots: [snapshot], evidence: makeEvidence([], session.notice), coverage: ['Foreground device-condition snapshots while Protect is open', mode === 'demo' ? 'Sample workspace excluded from device evidence' : 'Loaded historical records available at start'], limitations: [...session.limitations, 'No continuous background sampling or radio monitoring. The app records gaps when closed.'] }); }
      catch { commit({ ...session, status: 'interrupted', updatedAt: Date.now(), limitations: [...session.limitations, 'Device conditions were unavailable.'] }); }
      return;
    }
    setBusy(true);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const result = await runQuickIntegrity(controlled, __DEV__, networkConsent, controller.signal, () => mounted.current && AppState.currentState === 'active' && foregroundFocused.current, setProgress, partial => {
        const latest = sessionsRef.current.find(item => item.id === session.id) ?? session;
        commit({ ...latest, environment: partial.environment, snapshots: partial.snapshots, performance: partial.performance, coverage: partial.coverage,
          limitations: [...session.limitations, ...partial.limitations], updatedAt: Date.now() });
      });
      const evidence = makeEvidence(result.performance);
      const completed: IntegritySession = { ...session, status: 'completed', updatedAt: Date.now(), environment: result.environment,
        snapshots: result.snapshots, performance: result.performance, evidence, coverage: result.coverage,
        limitations: [...session.limitations, ...result.limitations, result.fileAccessMs === null ? 'App file latency unavailable.' : `App-owned file read/write took ${result.fileAccessMs} ms; this is not a storage health verdict.`, result.networkLatencyMs === null ? 'No internet response latency recorded.' : `Opt-in HTTPS response took ${result.networkLatencyMs} ms; this is not a Wi-Fi or Bluetooth speed measurement.`] };
      commit(completed);
      if (result.performance.length) {
        // A seven-sample experiment contributes one run, so it cannot create its own baseline.
        const history = [result.performance[result.performance.length - 1], ...performanceHistory].sort((a, b) => b.recordedAt - a.recordedAt).slice(0, 12);
        setPerformanceHistory(history);
        await AsyncStorage.setItem(performanceKey, JSON.stringify(history)).catch(() => setMessage('Timing baseline could not be saved.'));
      }
      setMessage('Quick scan finished. Review coverage and limitations below.');
    } catch (error) {
      const partial = sessionsRef.current.find(item => item.id === session.id) ?? session;
      commit({ ...partial, status: 'interrupted', updatedAt: Date.now(), limitations: [...partial.limitations, error instanceof Error ? error.message : 'The scan was interrupted.'] });
      setMessage(error instanceof Error ? error.message : 'The scan was interrupted.');
    } finally { abortRef.current = null; if (mounted.current) { setBusy(false); setProgress(null); } }
  }

  async function addMonitorSample() {
    if (!runningExtended || busy || monitorSampling.current) return;
    setBusy(true); setMessage('');
    try {
      const snapshot = await captureIntegrityEnvironment();
      const comparable = runningExtended.controlled && Platform.OS !== 'web' && snapshot.lowPowerMode === false && snapshot.batteryPercent !== null && snapshot.batteryPercent >= 20;
      const run = await runPerformanceProbe(Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web', __DEV__, comparable, () => mounted.current && AppState.currentState === 'active' && foregroundFocused.current);
      const latest = sessionsRef.current.find(item => item.id === runningExtended.id) ?? runningExtended;
      const performance = [...latest.performance, run].slice(-32);
      commit({ ...latest, snapshots: [...latest.snapshots, snapshot].slice(-288), performance, evidence: makeEvidence(performance, latest.notice), updatedAt: Date.now(), coverage: [...new Set([...latest.coverage, 'Manually requested in-app timing sample'])] });
      setMessage('Foreground snapshot recorded.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Snapshot could not be recorded.'); }
    finally { setBusy(false); }
  }

  async function importCompanion(session: IntegritySession) {
    let pickedUri: string | null = null;
    setBusy(true); setMessage('');
    try {
      const selection = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true, multiple: false });
      if (selection.canceled) return;
      const asset = selection.assets[0]; pickedUri = asset.uri;
      if (asset.size && asset.size > MAX_COMPANION_BYTES) throw new Error('The companion report exceeds the 5 MB import limit.');
      const raw = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
      const report = parseCompanionReport(raw);
      const evidence = [...makeEvidence([], session.notice), ...companionEvidence(report, indicators)];
      commit({ ...session, status: 'completed', updatedAt: Date.now(), evidence, importedReportName: asset.name.slice(0, 200),
        coverage: [...session.coverage, `${report.artifacts.length} companion artifact summaries from ${report.inputKind}`],
        limitations: [...session.limitations, ...report.warnings, 'Imported JSON is not authenticated. Verify the desktop tool and raw artifacts before relying on its claims.'] });
      setMessage(`Imported ${report.artifacts.length} artifact summaries locally. Raw backup data was not uploaded.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Companion result could not be imported.'); }
    finally { if (Platform.OS !== 'web' && pickedUri?.startsWith(Paths.cache.uri)) { try { new File(pickedUri).delete(); } catch { /* OS cache cleanup remains available. */ } } setBusy(false); }
  }

  async function exportSession(session: IntegritySession) {
    setBusy(true); setMessage('');
    try {
      const content = JSON.stringify({ schemaVersion: 1, type: 'ipward-device-integrity-report', exportedAt: new Date().toISOString(), session, priority: evidencePriority(session.evidence), note: 'Review priority is not a probability of spyware or a clean-device certification.' }, null, 2);
      const filename = `ipward-${session.kind}-${new Date(session.startedAt).toISOString().slice(0, 10)}.json`;
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor);
        try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      } else {
        if (!await Sharing.isAvailableAsync()) throw new Error('The share sheet is unavailable.');
        const file = new File(Paths.cache, filename); file.create({ overwrite: true }); file.write(content);
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export IPward scan report' });
      }
      setMessage('Report exported. Treat it as sensitive device information.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Report export failed.'); }
    finally { setBusy(false); }
  }

  const selectedChoice = scanChoices.find(choice => choice.kind === selected);
  const selectedColor = selectedChoice ? t[selectedChoice.color] : t.blue;
  const activePriority = active ? evidencePriority(active.evidence) : null;
  return <View style={{ gap: 15 }}>
    <Card style={{ borderColor: t.cyan, backgroundColor: t.blueTint }}>
      <Txt size={10} weight="700" color={t.cyan} style={{ letterSpacing: 1.4 }}>DEVICE INTEGRITY / SPYWARE DETECTION</Txt>
      <Txt size={19} weight="700" style={{ marginTop: 7 }}>Choose how deeply to look.</Txt>
      <Txt size={12} color={t.muted} style={{ marginTop: 6, lineHeight: 18 }}>Three guided scans combine what IPward can measure with evidence you choose to import. Every result shows its source and limits.</Txt>
      <InfoNote>No phone app can guarantee a device is clean. A slow phone, warm battery, or unknown Bluetooth device alone is not evidence of Pegasus.</InfoNote>
    </Card>

    <View style={{ gap: 10 }}>{scanChoices.map(choice => {
      const color = t[choice.color];
      return <Pressable key={choice.kind} accessibilityRole="button" accessibilityLabel={`Open ${choice.title}`} onPress={() => { setSelected(choice.kind); setActiveId(null); setMessage(''); }} style={({ pressed }) => ({ borderWidth: 1, borderColor: selected === choice.kind ? color : t.border, borderRadius: 18, backgroundColor: selected === choice.kind ? t.blueTint : t.surface, padding: 17, opacity: pressed ? 0.8 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 43, height: 43, borderRadius: 14, backgroundColor: t.elevated, alignItems: 'center', justifyContent: 'center' }}><Icon name={choice.icon} color={color} size={20}/></View>
          <View style={{ flex: 1 }}><Txt size={15} weight="700">{choice.title}</Txt><Txt size={11} color={t.muted} style={{ marginTop: 2 }}>{choice.subtitle}</Txt></View>
          <Icon name="chevron-right" color={color} size={18}/>
        </View>
        <Txt size={10} color={color} weight="700" style={{ marginTop: 11, letterSpacing: 0.4 }}>{choice.duration}</Txt>
      </Pressable>;
    })}</View>

    {selectedChoice && <Card style={{ borderColor: selectedColor }}>
      <SectionHeading title={`Before ${selectedChoice.title}`} subtitle="A few safety checks help interpret the result" />
      <Txt size={12} style={{ lineHeight: 19 }}>Have you received an Apple threat notification?</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
        {(['yes', 'no', 'unsure'] as const).map(value => <Pill key={value} label={value === 'yes' ? 'Yes' : value === 'no' ? 'No' : 'Not sure'} active={notice === value} onPress={() => setNotice(value)}/>) }
      </View>
      {notice === 'yes' && <View style={{ marginTop: 12, padding: 12, backgroundColor: t.elevated, borderRadius: 10 }}><Txt size={11} color={t.amber}>Verify it directly at account.apple.com. If safe, preserve the message and device evidence before major changes, and contact a trusted security expert. This answer is a targeting signal, not proof of infection.</Txt></View>}
      {selected === 'quick' && <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 17 }}><View style={{ flex: 1 }}><Txt size={12} weight="600">Calm conditions confirmed</Txt><Txt size={10} color={t.muted}>Phone cool, updated, charged, and otherwise idle</Txt></View><Switch accessibilityLabel="Confirm calm scan conditions" value={controlled} onValueChange={setControlled} trackColor={{ false: t.border, true: t.blue }}/></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}><View style={{ flex: 1 }}><Txt size={12} weight="600">Include internet response check</Txt><Txt size={10} color={t.muted}>One small HTTPS request to Cloudflare</Txt></View><Switch accessibilityLabel="Allow optional internet response check" value={networkConsent} onValueChange={setNetworkConsent} trackColor={{ false: t.border, true: t.blue }}/></View>
        <InfoNote>Keep this page open for about 8–12 minutes. Leaving the app interrupts the experiment. Camera, microphone, Bluetooth discovery, and system processes are outside this scan.</InfoNote>
        {Platform.OS === 'web' && <InfoNote>Browser preview: device conditions and native phone timing are unavailable here. Use an iOS or Android build for a phone scan.</InfoNote>}
      </>}
      {selected === 'extended' && <>
        <Txt size={12} weight="600" style={{ marginTop: 17 }}>Monitoring window</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>{([1, 6, 24] as const).map(value => <Pill key={value} label={`${value} hour${value === 1 ? '' : 's'}`} active={hours === value} onPress={() => setHours(value)}/>)}</View>
        <InfoNote>While Protect is open, IPward records conditions and an in-app timing sample about every 5 minutes. It does not run continuously in the background. Return to this page to review gaps.</InfoNote>
      </>}
      {selected === 'deep' && <InfoNote>The phone review uses your loaded records. Full encrypted backup and system artifact analysis need a separate trusted computer tool; no desktop companion is bundled with this build.</InfoNote>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}><Button label={selected === 'extended' && runningExtended ? 'Open current monitor' : `Start ${selectedChoice.title}`} icon="play" disabled={!ready || busy} onPress={() => { void begin(); }}/><Button label="Back" variant="ghost" onPress={() => setSelected(null)}/></View>
    </Card>}

    {busy && active?.kind === 'quick' && <KeepAwakeDuringQuickScan/>}
    {busy && progress && <Card style={{ borderColor: t.blue }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><PulsingDot color={t.blue}/><Txt size={13} weight="700">{progress.stage}</Txt></View>
      <View style={{ height: 7, borderRadius: 4, backgroundColor: t.elevated, marginTop: 15, overflow: 'hidden' }}><View style={{ width: `${Math.round(progress.fraction * 100)}%`, height: 7, borderRadius: 4, backgroundColor: t.blue }}/></View>
      <Txt size={11} color={t.muted} style={{ marginTop: 9 }}>{Math.round(progress.fraction * 100)}% · {Math.floor(progress.elapsedMs / 60_000)} min elapsed · app must stay open</Txt>
      <View style={{ marginTop: 14, alignSelf: 'flex-start' }}><Button label="Cancel scan" variant="secondary" onPress={() => abortRef.current?.abort()}/></View>
    </Card>}

    {!!message && <Txt accessibilityLiveRegion="polite" size={11} color={t.cyan}>{message}</Txt>}

    {active && <Card style={{ borderColor: active.status === 'running' ? t.cyan : t.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}><Icon name={scanChoices.find(item => item.kind === active.kind)?.icon ?? 'shield'} color={t.cyan}/><Txt size={16} weight="700" style={{ flex: 1 }}>{scanChoices.find(item => item.kind === active.kind)?.title}</Txt><Badge state={active.status}/></View>
      <Txt size={11} color={t.muted} style={{ marginTop: 8 }}>Started {formatTime(active.startedAt)}{active.endsAt ? ` · ${minutesLeft(active.endsAt, clock || active.startedAt)} min left` : ''}</Txt>
      {activePriority && <View style={{ borderRadius: 13, backgroundColor: t.elevated, padding: 13, marginTop: 14 }}><Txt size={10} color={t.muted} weight="700">REVIEW PRIORITY · NOT INFECTION PROBABILITY</Txt><Txt size={17} weight="700" color={activePriority.score > 0 ? t.amber : t.cyan} style={{ marginTop: 4 }}>{activePriority.score}/100 · {activePriority.label}</Txt><Txt size={10} color={t.muted} style={{ marginTop: 4 }}>Based only on the evidence available to IPward. Zero does not mean clean.</Txt></View>}
      {active.kind === 'extended' && active.status === 'running' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}><Button label={busy ? 'Recording…' : 'Add a snapshot now'} icon="activity" disabled={busy} onPress={() => { void addMonitorSample(); }}/><Button label="Finish monitor" variant="secondary" onPress={() => commit({ ...active, status: 'completed', updatedAt: Date.now(), limitations: [...active.limitations, 'The monitor was ended manually; its selected window was not completed.'] })}/></View>}
      {active.kind === 'deep' && <View style={{ marginTop: 16, gap: 9 }}>
        <Txt size={12} weight="700">Guided evidence steps</Txt>
        <Txt size={11} color={t.muted}>1. Import an Apple App Privacy Report in Settings and a trusted STIX2 file in Security Center if you have them.</Txt>
        <Txt size={11} color={t.muted}>2. For an iPhone backup, make an encrypted backup on a trusted computer. Preserve the original and use a qualified forensic workflow.</Txt>
        <Txt size={11} color={t.muted}>3. Import a version 1 IPward companion-result JSON when a compatible desktop analyzer is available. This app validates the contract but cannot authenticate the tool or inspect a backup itself.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button label="Import companion JSON" icon="download" disabled={busy} onPress={() => { void importCompanion(active); }}/><Button label="Import Apple report" variant="secondary" onPress={() => navigate('Settings')}/><Button label="Open indicators" variant="ghost" onPress={() => navigate('Security')}/></View>
        {active.status === 'running' && <Button label="Finish mobile review" variant="secondary" onPress={() => commit({ ...active, status: 'completed', updatedAt: Date.now(), limitations: [...active.limitations, 'No companion artifacts were examined. This was a mobile-only review.'] })}/>}
      </View>}
      <View style={{ height: 1, backgroundColor: t.border, marginVertical: 18 }}/>
      <Txt size={12} weight="700">What was checked</Txt>
      {active.coverage.length ? active.coverage.map((line, index) => <Txt key={`${index}-${line}`} size={11} color={t.cyan} style={{ marginTop: 6 }}>✓ {line}</Txt>) : <Txt size={11} color={t.muted} style={{ marginTop: 6 }}>{active.status === 'running' ? 'Scan is still preparing.' : 'No measurements were completed.'}</Txt>}
      {active.kind === 'quick' && <Txt size={11} color={t.muted} style={{ marginTop: 7 }}>{active.performance.length} of 7 timing samples recorded before {active.status === 'completed' ? 'completion' : active.status === 'interrupted' ? 'interruption' : 'now'}.</Txt>}
      {active.kind === 'extended' && <Txt size={11} color={t.muted} style={{ marginTop: 7 }}>{active.snapshots.length} condition snapshots · {active.performance.length} timing samples. Gaps between foreground visits are unobserved.</Txt>}
      {!!active.environment && <Txt size={11} color={t.muted} style={{ marginTop: 7 }}>{active.environment.model ?? 'Model unavailable'} · {active.environment.osVersion ?? 'OS unavailable'} · battery {active.environment.batteryPercent === null ? 'unavailable' : `${active.environment.batteryPercent}%`} · network {active.environment.networkType ?? 'unavailable'}</Txt>}
      <Txt size={12} weight="700" style={{ marginTop: 18 }}>Evidence timeline</Txt>
      {active.evidence.length ? active.evidence.slice(0, 20).map(item => <EvidenceRow key={item.id} item={item}/>) : <Txt size={11} color={t.muted} style={{ marginTop: 7 }}>No leads in the sources reviewed so far. This does not rule out spyware.</Txt>}
      {active.evidence.length > 20 && <Txt size={11} color={t.muted} style={{ marginTop: 6 }}>Showing 20 of {active.evidence.length} leads. Export for the full list.</Txt>}
      <Txt size={12} weight="700" style={{ marginTop: 18 }}>Limits of this result</Txt>
      {active.limitations.map((line, index) => <Txt key={`${index}-${line}`} size={11} color={t.muted} style={{ marginTop: 5 }}>• {line}</Txt>)}
      <View style={{ marginTop: 18, alignSelf: 'flex-start' }}><Button label="Export local JSON report" icon="share-2" variant="secondary" disabled={busy} onPress={() => { void exportSession(active); }}/></View>
    </Card>}

    {ready && sessions.length > 0 && <Card><SectionHeading title="Scan history" subtitle="Saved locally on this device · latest 20 sessions"/>{sessions.slice(0, 8).map(session => <Pressable key={session.id} accessibilityRole="button" accessibilityLabel={`Open ${session.kind} scan from ${formatTime(session.startedAt)}`} onPress={() => { setActiveId(session.id); setSelected(null); }} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 47, borderTopWidth: 1, borderTopColor: t.border }}><Icon name={scanChoices.find(item => item.kind === session.kind)?.icon ?? 'shield'} color={t.cyan} size={16}/><Txt size={11} style={{ flex: 1 }}>{session.kind === 'quick' ? 'Quick Integrity Scan' : session.kind === 'extended' ? 'Extended Monitor' : 'Deep Spyware Scan'} · {new Date(session.startedAt).toLocaleDateString()}</Txt><Txt size={10} color={t.muted}>{session.status}</Txt></Pressable>)}</Card>}
  </View>;
}
