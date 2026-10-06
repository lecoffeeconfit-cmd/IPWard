import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Icon, IconName, InfoNote, SectionHeading, Txt } from '../components/ui';
import { ConnectionDiagnostics } from '../components/ConnectionDiagnostics';
import { PerformanceCheck } from '../components/PerformanceCheck';
import { DeviceSecurityChecklist } from '../components/DeviceSecurityChecklist';
import { ConnectionTestResult, isStoredConnectionTest } from '../services/connectionTest';
import { comparePerformanceRun, isStoredPerformanceRun, PerformanceRun } from '../services/performanceProbe';
import { buildSecurityReview, SecurityCheck, SecurityFinding } from '../services/securityScan';
import { isStoredSecurityIndicators, MAX_SECURITY_INDICATOR_BYTES, parseSecurityIndicators, SecurityIndicatorSet } from '../services/securityIndicators';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';

type Focus = 'quick' | 'network' | 'connectivity' | 'performance' | 'spyware' | 'forensic';
const storageKey = 'ipward.securityIndicators.v1';
const performanceStorageKey = 'ipward.performanceRuns.v1';
const connectionStorageKey = 'ipward.connectionTests.v1';
const choices: { id: Focus; title: string; subtitle: string; icon: IconName }[] = [
  { id: 'quick', title: 'Quick scan', subtitle: 'Review available evidence', icon: 'zap' },
  { id: 'network', title: 'Network threats', subtitle: 'Contacts and unusual patterns', icon: 'globe' },
  { id: 'connectivity', title: 'Internet & devices', subtitle: 'Wi-Fi, data and Bluetooth', icon: 'wifi' },
  { id: 'performance', title: 'Phone speed', subtitle: 'Compare with your usual', icon: 'clock' },
  { id: 'spyware', title: 'Spyware & compromise', subtitle: 'Indicators and device checks', icon: 'shield' },
  { id: 'forensic', title: 'Deep forensic', subtitle: 'A guided specialist workflow', icon: 'search' },
];
const official = {
  appleUpdates: 'https://support.apple.com/guide/iphone/update-ios-iph3e504502/ios',
  appleProfiles: 'https://support.apple.com/en-gb/guide/iphone/iph6c493b19/ios',
  appleLockdown: 'https://support.apple.com/105120',
  androidUpdates: 'https://support.google.com/android/answer/7680439',
  androidPlayProtect: 'https://support.google.com/googleplay/answer/2812853',
  mvt: 'https://docs.mvt.re/en/latest/',
};

function StatusChip({ check }: { check: SecurityCheck }) {
  const t = useTheme();
  const label = check.status === 'reviewed' ? 'Reviewed' : check.status === 'needs-data' ? 'Needs data' : check.status === 'desktop-only' ? 'Desktop' : 'Device settings';
  const color = check.status === 'reviewed' ? t.cyan : check.status === 'needs-data' ? t.amber : t.muted;
  return <View style={{ borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: t.elevated, borderColor: t.border, borderWidth: 1 }}><Txt size={10} weight="700" color={color}>{label}</Txt></View>;
}

function CheckRow({ check }: { check: SecurityCheck }) {
  const t = useTheme();
  return <View style={{ borderTopWidth: 1, borderTopColor: t.border, paddingVertical: 15, gap: 5 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}><Txt size={13} weight="600" style={{ flex: 1 }}>{check.title}</Txt><StatusChip check={check}/></View>
    <Txt size={11} color={t.muted} style={{ lineHeight: 17 }}>{check.detail}</Txt>
  </View>;
}

function FindingRow({ finding, onOpen }: { finding: SecurityFinding; onOpen?: () => void }) {
  const t = useTheme();
  const color = finding.kind === 'indicator' ? t.red : finding.kind === 'list' ? t.amber : t.cyan;
  return <View style={{ borderLeftWidth: 3, borderLeftColor: color, paddingLeft: 14, paddingVertical: 9, marginBottom: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Txt size={13} weight="600">{finding.title}</Txt><Txt size={10} color={color} weight="700">{finding.kind === 'indicator' ? 'INDICATOR' : finding.kind === 'list' ? 'YOUR LIST' : 'BEHAVIOR'}</Txt></View>
    <Txt size={11} color={t.muted} style={{ marginTop: 3 }}>{new Date(finding.timestamp).toLocaleString()} · {finding.source}</Txt>
    <Txt size={12} style={{ marginTop: 8, lineHeight: 18 }}>{finding.detail}</Txt>
    <Txt size={11} color={t.muted} style={{ marginTop: 7, lineHeight: 17 }}>Next: {finding.advice}</Txt>
    {onOpen && <Pressable accessibilityRole="button" onPress={onOpen} style={{ minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }}><Txt size={11} weight="700" color={t.blue}>View connection  ↗</Txt></Pressable>}
  </View>;
}

function GuideRow({ icon, title, detail, action, onPress }: { icon: IconName; title: string; detail: string; action: string; onPress: () => void }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 15, borderTopWidth: 1, borderTopColor: t.border }}>
    <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: t.elevated, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={16} color={t.cyan}/></View>
    <View style={{ flex: 1 }}><Txt size={13} weight="600">{title}</Txt><Txt size={11} color={t.muted} style={{ marginTop: 4, lineHeight: 17 }}>{detail}</Txt><Pressable accessibilityRole="link" accessibilityLabel={action} onPress={onPress} style={{ minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }}><Txt size={11} weight="700" color={t.blue}>{action}  ↗</Txt></Pressable></View>
  </View>;
}

export function SecurityScreen() {
  const t = useTheme();
  const { focus: requestedFocus } = useLocalSearchParams<{ focus?: string }>();
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const { dataset, mode, localReputation, navigate, openDetail, toast } = useApp();
  const [focus, setFocus] = useState<Focus>(requestedFocus === 'connectivity' ? 'connectivity' : 'quick');
  const [indicators, setIndicators] = useState<SecurityIndicatorSet | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const [confirmExport, setConfirmExport] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState('');
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceRun[]>([]);
  const [performanceReady, setPerformanceReady] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState<ConnectionTestResult[]>([]);
  const [connectionReady, setConnectionReady] = useState(false);
  const review = useMemo(() => buildSecurityReview(dataset, mode, indicators, localReputation, Math.max(dataset.generatedAt, lastScanAt ?? 0)), [dataset, mode, indicators, localReputation, lastScanAt]);
  const reviewed = review.checks.filter(check => check.status === 'reviewed').length;
  const indicatorsFound = review.findings.filter(item => item.kind === 'indicator').length;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey).then(raw => {
      if (!active || !raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (isStoredSecurityIndicators(parsed)) setIndicators(parsed);
    }).catch(() => { if (active) setImportMessage('Saved indicators could not be loaded.'); }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const operation = indicators ? AsyncStorage.setItem(storageKey, JSON.stringify(indicators)) : AsyncStorage.removeItem(storageKey);
    operation.catch(() => setImportMessage('Indicators could not be saved locally.'));
  }, [indicators, loaded]);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(performanceStorageKey).then(raw => {
      if (!active || !raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) setPerformanceHistory(parsed.filter(isStoredPerformanceRun).sort((a, b) => b.recordedAt - a.recordedAt).slice(0, 12));
    }).catch(() => { if (active) toast('Saved timing history could not be loaded.'); }).finally(() => { if (active) setPerformanceReady(true); });
    return () => { active = false; };
  }, [toast]);
  useEffect(() => {
    if (!performanceReady) return;
    const operation = performanceHistory.length ? AsyncStorage.setItem(performanceStorageKey, JSON.stringify(performanceHistory)) : AsyncStorage.removeItem(performanceStorageKey);
    operation.catch(() => toast('Timing history could not be saved locally.'));
  }, [performanceHistory, performanceReady, toast]);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(connectionStorageKey).then(raw => {
      if (!active || !raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) setConnectionHistory(parsed.filter(isStoredConnectionTest).sort((a, b) => b.recordedAt - a.recordedAt).slice(0, 12));
    }).catch(() => { if (active) toast('Saved internet tests could not be loaded.'); }).finally(() => { if (active) setConnectionReady(true); });
    return () => { active = false; };
  }, [toast]);
  useEffect(() => {
    if (!connectionReady) return;
    const operation = connectionHistory.length ? AsyncStorage.setItem(connectionStorageKey, JSON.stringify(connectionHistory)) : AsyncStorage.removeItem(connectionStorageKey);
    operation.catch(() => toast('Internet test history could not be saved locally.'));
  }, [connectionHistory, connectionReady, toast]);
  function openGuide(url: string) { void Linking.openURL(url).catch(() => toast('Could not open the guide on this device.')); }
  async function importIndicators() {
    setImportMessage('');
    let pickedUri: string | null = null;
    try {
      const selection = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false, base64: false });
      if (selection.canceled) return;
      const asset = selection.assets[0];
      pickedUri = asset.uri;
      if (asset.size && asset.size > MAX_SECURITY_INDICATOR_BYTES) throw new Error('This indicator file exceeds the 5 MB import limit.');
      setImportBusy(true);
      const contents = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
      const parsed = parseSecurityIndicators(contents, asset.name);
      setIndicators(parsed);
      setImportMessage(`Imported ${parsed.domains.length + parsed.ips.length + parsed.appIds.length} exact indicators locally. ${parsed.skipped} unsupported, expired or revoked indicators were skipped.`);
      toast('Indicator file saved locally. Review the source before acting on matches.');
    } catch (error) { setImportMessage(error instanceof Error ? error.message : 'The indicator file could not be imported.'); }
    finally {
      setImportBusy(false);
      if (Platform.OS !== 'web' && pickedUri?.startsWith(Paths.cache.uri)) { try { new File(pickedUri).delete(); } catch { /* OS cache cleanup remains available. */ } }
    }
  }
  async function exportReview() {
    setExportBusy(true); setExportError('');
    try {
      const latestPerformance = performanceHistory[0] ?? null;
      const content = JSON.stringify({ schemaVersion: 1, product: 'IPward', type: 'security-review', exportedAt: new Date().toISOString(), ...review, indicatorSource: indicators ? { name: indicators.name, importedAt: indicators.importedAt, supportedCount: review.indicatorCount, skipped: indicators.skipped } : null, performance: latestPerformance ? { latestRun: latestPerformance, comparison: comparePerformanceRun(latestPerformance, performanceHistory), source: 'IPward in-app JavaScript timing only' } : null, connectionTest: connectionHistory[0] ?? null, limitations: ['This reviews only evidence available inside IPward.', 'No finding or absence of findings establishes whether the device has been compromised.', 'Imported indicators are user supplied and unverified.', 'Performance timings cannot identify spyware or the process causing a delay.', 'Internet speed tests are estimates against Cloudflare, not Wi-Fi radio or Bluetooth device transfer rates.', 'No operating-system forensic artifacts were examined.'] }, null, 2);
      const filename = `ipward-security-${new Date(review.generatedAt).toISOString().slice(0, 10)}.json`;
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor);
        try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
        toast('Security review download started.');
      } else {
        if (!await Sharing.isAvailableAsync()) throw new Error('The share sheet is unavailable on this device.');
        const file = new File(Paths.cache, filename); file.create({ overwrite: true }); file.write(content);
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export IPward security review' });
        toast('Share sheet closed. A temporary report copy remains in app cache until the system clears it.');
      }
      setConfirmExport(false);
    } catch (error) { setExportError(error instanceof Error ? error.message : 'The security review could not be exported.'); }
    finally { setExportBusy(false); }
  }
  const shownFindings = review.findings.filter(item => focus === 'network' ? item.kind !== 'list' : focus === 'spyware' ? item.kind === 'indicator' || item.kind === 'list' : true);

  return <View style={{ gap: 19 }}>
    <Card style={{ backgroundColor: t.blueTint, borderColor: t.blue, padding: compact ? 19 : 25 }}>
      <View style={{ flexDirection: compact ? 'column' : 'row', justifyContent: 'space-between', gap: 16 }}>
        <View style={{ flex: 1 }}><Txt size={10} color={t.blue} weight="700" style={{ letterSpacing: 1.7 }}>SECURITY CENTER / LOCAL REVIEW</Txt><Txt size={compact ? 22 : 27} weight="600" style={{ marginTop: 8, letterSpacing: -0.6 }}>Know what the evidence can say.</Txt><Txt size={12} color={t.muted} style={{ marginTop: 7, maxWidth: 590, lineHeight: 19 }}>Review available network records and your own indicator files. Device integrity and advanced spyware artifacts need separate system or desktop checks.</Txt></View>
        <View style={{ alignSelf: compact ? 'flex-start' : 'center' }}><Button label={lastScanAt ? 'Run again' : 'Scan loaded evidence'} icon="search" onPress={() => setLastScanAt(Date.now())}/></View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 19 }}>
        <View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, padding: 13, borderRadius: 13, minWidth: 118 }}><Txt size={22} weight="600" color={t.cyan}>{reviewed}/{review.checks.length}</Txt><Txt size={10} color={t.muted}>Evidence checks reviewed</Txt></View>
        <View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, padding: 13, borderRadius: 13, minWidth: 118 }}><Txt size={22} weight="600" color={indicatorsFound ? t.red : t.text}>{indicators && review.recordsReviewed ? indicatorsFound : '—'}</Txt><Txt size={10} color={t.muted}>Imported indicator matches</Txt></View>
        <View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, padding: 13, borderRadius: 13, minWidth: 118 }}><Txt size={22} weight="600">{review.recordsReviewed.toLocaleString()}</Txt><Txt size={10} color={t.muted}>Loaded records reviewed</Txt></View>
      </View>
      <Txt size={11} color={t.muted} style={{ marginTop: 12 }}>{review.sample ? 'Sample workspace · these results are illustrative.' : 'Device workspace · only imported or locally available evidence is reviewed.'} {lastScanAt ? `Last manual review ${new Date(lastScanAt).toLocaleString()}.` : 'Tap Scan loaded evidence to refresh this review.'}</Txt>
    </Card>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{choices.map(choice => <Pressable key={choice.id} accessibilityRole="button" accessibilityState={{ selected: focus === choice.id }} onPress={() => setFocus(choice.id)} style={({ pressed }) => ({ flexGrow: 1, flexBasis: compact ? '46%' : '27%', minWidth: 145, padding: 16, minHeight: 102, borderRadius: 16, borderWidth: 1, borderColor: focus === choice.id ? (choice.id === 'performance' ? t.purple : choice.id === 'connectivity' ? t.cyan : t.blue) : t.border, backgroundColor: focus === choice.id ? (choice.id === 'performance' ? t.purpleTint : choice.id === 'connectivity' ? t.cyanTint : t.blueTint) : t.surface, opacity: pressed ? 0.78 : 1 })}><Icon name={choice.icon} size={18} color={focus === choice.id ? (choice.id === 'performance' ? t.purple : choice.id === 'connectivity' ? t.cyan : t.blue) : t.cyan}/><Txt size={13} weight="700" style={{ marginTop: 8 }}>{choice.title}</Txt><Txt size={10} color={t.muted} style={{ marginTop: 2 }}>{choice.subtitle}</Txt></Pressable>)}</View>

    {focus === 'quick' && <>
      <Card><SectionHeading title="What was checked" subtitle="A reviewed check means data was compared, not that it passed a security test"/>{review.checks.map(check => <CheckRow key={check.id} check={check}/>)}</Card>
      <Card><DeviceSecurityChecklist/></Card>
      <Card><SectionHeading title="Recent security events" subtitle="Indicator matches, local list matches and behavior changes in loaded evidence"/>{shownFindings.length ? shownFindings.slice(0, 8).map(item => <FindingRow key={item.id} finding={item} onOpen={item.connectionId ? () => openDetail({ type: 'connection', id: item.connectionId! }) : undefined}/>) : <Txt size={12} color={t.muted}>No items appeared in the evidence reviewed. This does not rule out compromise or activity outside IPward’s view.</Txt>}{shownFindings.length > 8 && <Button label="See all network findings" variant="secondary" onPress={() => setFocus('network')}/>}</Card>
    </>}

    {focus === 'network' && <>
      <Card><SectionHeading title="Network threat scan" subtitle="Exact indicator matches and behavior clues are kept separate"/><InfoNote>IPward has no verified threat feed or live packet provider. Country, ASN and hosting labels in imported Apple reports are unavailable; the app does not guess them.</InfoNote><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}><Button label="View connections" icon="git-branch" variant="secondary" onPress={() => navigate('Connections')}/><Button label="Import Apple report" icon="download" variant="ghost" onPress={() => navigate('Settings')}/><Button label="Open Protect rules" icon="shield" variant="ghost" onPress={() => navigate('Protect')}/></View></Card>
      <Card><SectionHeading title="Connection timeline" subtitle="Most recent observations first"/>{shownFindings.length ? shownFindings.map(item => <FindingRow key={item.id} finding={item} onOpen={item.connectionId ? () => openDetail({ type: 'connection', id: item.connectionId! }) : undefined}/>) : <Txt size={12} color={t.muted}>No indicator matches or behavior clues in the loaded records. This is not a clean-device verdict.</Txt>}</Card>
    </>}

    {focus === 'performance' && <PerformanceCheck history={performanceHistory} ready={performanceReady} onSave={run => setPerformanceHistory(previous => [run, ...previous].slice(0, 12))} onClear={() => setPerformanceHistory([])}/>}

    {focus === 'connectivity' && <ConnectionDiagnostics history={connectionHistory} ready={connectionReady} onSave={result => setConnectionHistory(previous => [result, ...previous].slice(0, 12))} onClear={() => setConnectionHistory([])}/>}

    {focus === 'spyware' && <>
      <Card><SectionHeading title="Spyware indicator comparison" subtitle="Bring a STIX2 file from a source you trust"/><Txt size={12} color={t.muted} style={{ lineHeight: 19 }}>IPward compares exact domains, IPv4 addresses and app IDs with loaded records. It does not inspect files, processes, URL paths, configuration profiles, system logs or other apps. A match is a lead for investigation, not proof of infection.</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}><Button label={importBusy ? 'Importing…' : indicators ? 'Replace indicator file' : 'Import indicator file'} icon="download" onPress={() => { void importIndicators(); }} disabled={importBusy}/>{indicators && <Button label="Remove file" icon="trash-2" variant="secondary" onPress={() => { setIndicators(null); setImportMessage('Indicator file removed from local storage.'); }}/>}</View>{indicators && <Txt size={11} color={t.cyan} style={{ marginTop: 12 }}>{indicators.name} · {review.indicatorCount.toLocaleString()} supported indicators · imported {new Date(indicators.importedAt).toLocaleDateString()}</Txt>}{!!importMessage && <Txt accessibilityLiveRegion="polite" size={11} color={t.muted} style={{ marginTop: 10 }}>{importMessage}</Txt>}</Card>
      <Card><SectionHeading title="Indicator and list results" subtitle="Your files are stored on this device"/>{shownFindings.length ? shownFindings.map(item => <FindingRow key={item.id} finding={item} onOpen={item.connectionId ? () => openDetail({ type: 'connection', id: item.connectionId! }) : undefined}/>) : <Txt size={12} color={t.muted}>{!review.recordsReviewed ? 'No network records are loaded to compare.' : !indicators && !localReputation ? 'Import a STIX2 indicator file here or a domain list in Protect to run a comparison.' : 'No matches in loaded records. This cannot establish whether Pegasus, Predator or another threat is absent.'}</Txt>}</Card>
      <Card><SectionHeading title="Guided device checks" subtitle="Open the relevant system guidance and review anything unfamiliar"/>
        {Platform.OS === 'ios' ? <>
          <GuideRow icon="smartphone" title="Check iOS updates" detail="Install the latest security update available for your device." action="Apple update guide" onPress={() => openGuide(official.appleUpdates)}/>
          <GuideRow icon="layers" title="Review profiles and management" detail="Look for configuration profiles or management you do not recognize. Ask your organization before removing a work profile." action="Apple profile guide" onPress={() => openGuide(official.appleProfiles)}/>
          <GuideRow icon="lock" title="Consider Lockdown Mode if targeted" detail="Apple provides Lockdown Mode for people who may face sophisticated targeted attacks." action="Apple Lockdown Mode" onPress={() => openGuide(official.appleLockdown)}/>
        </> : Platform.OS === 'android' ? <>
          <GuideRow icon="smartphone" title="Check Android security updates" detail="Review the OS and security update dates in your device settings." action="Android update guide" onPress={() => openGuide(official.androidUpdates)}/>
          <GuideRow icon="shield" title="Review Play Protect" detail="Inspect its device scan and review apps you do not recognize." action="Google Play Protect guide" onPress={() => openGuide(official.androidPlayProtect)}/>
          <GuideRow icon="eye" title="Review special app access" detail="In system settings, review Accessibility, overlays, screen capture, VPN and installed certificates. IPward cannot attest to these settings." action="Open device settings" onPress={() => { void Linking.openSettings().catch(() => toast('Could not open device settings.')); }}/>
        </> : <>
          <GuideRow icon="smartphone" title="Checking an iPhone?" detail="Open the guide on the device you want to review, then inspect its update and security settings." action="Apple update guide" onPress={() => openGuide(official.appleUpdates)}/>
          <GuideRow icon="smartphone" title="Checking an Android phone?" detail="Review its OS and security update status from the device itself." action="Android update guide" onPress={() => openGuide(official.androidUpdates)}/>
        </>}
      </Card>
    </>}

    {focus === 'forensic' && <>
      <Card><SectionHeading title="Deep forensic scan" subtitle="For a suspected targeted compromise"/><Txt size={12} color={t.muted} style={{ lineHeight: 20 }}>A full forensic check requires consent, a computer and access to backups or logs outside this app’s sandbox. IPward has no desktop companion connected, so it cannot run that scan here.</Txt><View style={{ gap: 13, marginTop: 20 }}>
        {['1  Preserve the original evidence and note the time of concerning events.', '2  Consult a qualified incident responder before changing or wiping a potentially compromised device.', '3  With consent, create a local device backup and use a reputable forensic workflow such as MVT.', '4  Compare forensic artifacts with current indicators, then have a specialist interpret the results.'].map(step => <View key={step} style={{ padding: 13, borderRadius: 12, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border }}><Txt size={12}>{step}</Txt></View>)}
      </View><View style={{ alignSelf: 'flex-start', marginTop: 17 }}><Button label="Read MVT documentation" icon="book-open" variant="secondary" onPress={() => openGuide(official.mvt)}/></View><InfoNote>Even a forensic review with no known matches cannot prove a device has never been compromised. The exported IPward report contains this app’s findings, not a device backup.</InfoNote></Card>
    </>}

    <Card><SectionHeading title="Share a security review" subtitle="A local report for your own records or a trusted professional"/><Txt size={12} color={t.muted} style={{ lineHeight: 18 }}>The JSON report includes findings, timestamps, destinations, coverage notes and your latest timing and internet test results, if present. It may reveal sensitive app activity. IPward does not upload this report.</Txt>{!confirmExport ? <View style={{ alignSelf: 'flex-start', marginTop: 16 }}><Button label="Generate security report" icon="file-text" variant="secondary" onPress={() => setConfirmExport(true)}/></View> : <View style={{ marginTop: 17, gap: 12 }}><Badge state="Observed"/><Txt size={11} color={t.muted}>Review before sharing: this report may contain app IDs, domains, IPs and activity times.</Txt><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><Button label={exportBusy ? 'Preparing…' : 'Export JSON'} icon="share-2" onPress={() => { void exportReview(); }} disabled={exportBusy}/><Button label="Cancel" variant="ghost" onPress={() => setConfirmExport(false)}/></View></View>}{!!exportError && <Txt accessibilityRole="alert" size={11} color={t.red} style={{ marginTop: 8 }}>{exportError}</Txt>}</Card>
  </View>;
}
