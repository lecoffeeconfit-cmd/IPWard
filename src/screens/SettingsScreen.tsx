import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { Badge, Button, Card, Icon, IconName, InfoNote, Pill, SectionHeading, Txt } from '../components/ui';
import { filterByRange, formatBytes, getRangeInterval } from '../services/analytics';
import { Settings, useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { TimeRange } from '../types';
import { createActivityReport, createConnectionCsv, utf8ByteLength } from '../utils/export';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { parseApplePrivacyReport } from '../services/appleReport';

type DestructiveAction = 'history' | 'captures' | null;
type ExportFormat = 'json' | 'csv' | null;

function PreferenceRow({ icon, title, description, value, onChange, disabled = false, last = false }: {
  icon: IconName; title: string; description: string; value: boolean; onChange?: (value: boolean) => void; disabled?: boolean; last?: boolean;
}) {
  const t = useTheme();
  return <View style={[local.row, { borderBottomColor: t.border, borderBottomWidth: last ? 0 : 1 }]}>
    <View style={[local.icon, { backgroundColor: t.elevated }]}><Icon name={icon} size={17} color={t.blue}/></View>
    <View style={{ flex: 1, gap: 4 }}><Txt size={13} weight="500">{title}</Txt><Txt size={11} color={t.muted}>{description}</Txt></View>
    <Switch
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      accessibilityLabel={title}
      accessibilityHint={description}
      trackColor={{ false: t.elevated, true: t.blue }}
      thumbColor={value ? '#F3F6FC' : t.muted}
      ios_backgroundColor={t.elevated}
    />
  </View>;
}

const monitoringChoices: { name: Settings['monitoring']; icon: IconName; detail: string }[] = [
  { name: 'Standard', icon: 'activity', detail: 'Balanced detail and resource use' },
  { name: 'Enhanced', icon: 'sliders', detail: 'Prefer more detailed observations' },
  { name: 'Battery saver', icon: 'battery', detail: 'Prefer fewer background updates' },
];

export function SettingsScreen() {
  const { settings, updateSettings, mode, setMode, dataset, range, captures, clearCaptures, clearHistory, importReport, usageAccess, refreshUsage, openUsageSettings, blockedDomains, navigate, toast, setDemoPaused } = useApp();
  const t = useTheme();
  const { width } = useWindowDimensions();
  const twoColumns = width >= 1100;
  const [confirmDelete, setConfirmDelete] = useState<DestructiveAction>(null);
  const [confirmExport, setConfirmExport] = useState<ExportFormat>(null);
  const [exportScope, setExportScope] = useState<TimeRange | 'All loaded'>('Today');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const loadedBytes = useMemo(() => utf8ByteLength(JSON.stringify(dataset)), [dataset]);
  const storedBytes = useMemo(() => utf8ByteLength(JSON.stringify({ settings, captures, blockedDomains, mode })), [settings, captures, blockedDomains, mode]);
  const savedCaptureBytes = useMemo(() => utf8ByteLength(JSON.stringify(captures)), [captures]);
  const selectedDataset = useMemo(() => {
    if (exportScope === 'All loaded') return dataset;
    return {
      ...dataset,
      connections: filterByRange(dataset.connections, exportScope),
      sensors: filterByRange(dataset.sensors, exportScope),
      communications: filterByRange(dataset.communications, exportScope),
      alerts: filterByRange(dataset.alerts, exportScope),
      appUsage: (dataset.appUsage ?? []).filter(row => {
        const interval = getRangeInterval(exportScope, dataset.generatedAt);
        return row.dayStart >= interval.start && row.dayStart <= interval.end;
      }),
    };
  }, [dataset, exportScope]);

  function selectScope(scope: TimeRange | 'All loaded') {
    setExportScope(scope);
    setConfirmExport(null);
    setExportError(null);
  }

  function removeTemporaryReports(): number {
    if (Platform.OS === 'web') return 0;
    let count = 0;
    for (const entry of Paths.cache.list()) {
      if (entry instanceof File && /^ipward-(demo|device)-\d{4}-\d{2}-\d{2}\.(json|csv)$/.test(entry.name)) {
        entry.delete();
        count++;
      }
    }
    return count;
  }

  function clearTemporaryReports() {
    try {
      const count = removeTemporaryReports();
      toast(count ? `Deleted ${count} temporary report ${count === 1 ? 'file' : 'files'}.` : 'No temporary report files were found.');
    } catch {
      toast('Could not clear temporary report files. Please try again.');
    }
  }

  async function exportReport(format: Exclude<ExportFormat, null>) {
    setExportBusy(true);
    setExportError(null);
    try {
      const interval = exportScope === 'All loaded' ? null : getRangeInterval(exportScope);
      const includedCaptures = interval ? captures.filter(capture => capture.startedAt >= interval.start && capture.startedAt <= interval.end) : captures;
      const content = format === 'json'
        ? createActivityReport(selectedDataset, includedCaptures, exportScope)
        : createConnectionCsv(selectedDataset);
      const filename = `ipward-${mode}-${new Date().toISOString().slice(0, 10)}.${format}`;
      if (Platform.OS === 'web') {
        const blob = new Blob([format === 'csv' ? '\uFEFF' + content : content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
        toast('Your local report download has started.');
      } else {
        if (!await Sharing.isAvailableAsync()) throw new Error('The share sheet is unavailable on this device.');
        const file = new File(Paths.cache, filename);
        file.create({ overwrite: true });
        file.write(format === 'csv' ? '\uFEFF' + content : content);
        await Sharing.shareAsync(file.uri, { mimeType: format === 'csv' ? 'text/csv' : 'application/json', dialogTitle: 'Export IPward report' });
        toast('Report share sheet closed. A temporary copy remains in app cache until the system clears it.');
      }
      setConfirmExport(null);
    } catch (error) {
      setExportError(error instanceof Error && error.message.startsWith('The share sheet is unavailable')
        ? error.message
        : 'The report could not be exported. Try a smaller time range or try again.');
    } finally {
      setExportBusy(false);
    }
  }

  async function importAppleReport() {
    setImportError(null); setImportResult(null);
    try {
      const selection = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false, base64: false });
      if (selection.canceled) return;
      const asset = selection.assets[0];
      if (asset.size && asset.size > 12_000_000) throw new Error('Report is larger than the 12 MB import limit.');
      setImportBusy(true);
      let report;
      try {
        const contents = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
        report = parseApplePrivacyReport(contents);
        await importReport(report);
      } finally {
        if (Platform.OS !== 'web' && asset.uri.startsWith(Paths.cache.uri)) {
          try { new File(asset.uri).delete(); } catch { /* OS cache cleanup remains available. */ }
        }
      }
      setImportResult(`Imported ${report.networkRecords.toLocaleString()} domain records (${report.totalContacts.toLocaleString()} reported contacts) and ${report.sensorIntervals.toLocaleString()} sensor intervals. ${report.skipped ? `${report.skipped.toLocaleString()} incomplete or unsupported rows were skipped.` : 'No rows were skipped.'}`);
      toast('Apple report imported locally. Viewing the last 7 days.');
    } catch (error) { setImportError(error instanceof Error ? error.message : 'The report could not be imported.'); }
    finally { setImportBusy(false); }
  }

  async function deleteSelected() {
    if (confirmDelete === 'history') {
      try {
        await clearHistory();
        let cacheCleared = true;
        try { removeTemporaryReports(); } catch { cacheCleared = false; }
        toast(cacheCleared ? 'Workspace history, saved captures, and temporary exports cleared.' : 'Workspace history cleared. Temporary exports could not be removed; use Clear temporary exports to retry.');
      }
      catch { toast('Could not delete imported history. Please try again.'); return; }
    } else if (confirmDelete === 'captures') {
      clearCaptures();
      toast('Saved captures cleared.');
    }
    setConfirmDelete(null);
  }

  return <View style={{ gap: 20 }}>
    <Card style={{ paddingVertical: 19 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
        <View style={[local.icon, { width: 44, height: 44, backgroundColor: t.cyanTint }]}><Icon name="hard-drive" color={t.cyan} size={21}/></View>
        <View style={{ flex: 1 }}><Txt size={16} weight="600">Your data. Your settings.</Txt><Txt size={12} color={t.muted} style={{ marginTop: 3 }}>Imported observations, preferences, and captures stay on this device until you share an export.</Txt></View>
        <Icon name="check-circle" size={18} color={t.cyan}/>
      </View>
    </Card>

    <Card>
      <SectionHeading title="Import an Apple App Privacy Report" subtitle="Real, user-authorized evidence from your iPhone or iPad"/>
      <Txt size={12} color={t.muted} style={{ lineHeight: 20 }}>In Settings → Privacy & Security → App Privacy Report, turn on reporting, then use Share to save the .ndjson report. Import that file here. IPward reads it on this device and keeps its original source label.</Txt>
      <View style={{ marginTop: 17, alignSelf: 'flex-start' }}><Button label={importBusy ? 'Importing…' : 'Choose report file'} icon="download" onPress={() => { void importAppleReport(); }} disabled={importBusy}/></View>
      <InfoNote>Apple reports domain contacts and sensor access intervals. They do not include transfer bytes, payloads, server locations, or app foreground state. Importing the same report again updates existing records.</InfoNote>
      {importResult && <Txt accessibilityLiveRegion="polite" size={12} color={t.cyan} style={{ marginTop: 13 }}>{importResult}</Txt>}
      {importError && <Txt accessibilityRole="alert" size={12} color={t.red} style={{ marginTop: 13 }}>{importError}</Txt>}
      <View style={{ marginTop: 14, alignSelf: 'flex-start' }}><Button label="Review data & ads" icon="target" variant="secondary" onPress={() => navigate('Marketing')}/></View>
    </Card>

    {Platform.OS === 'android' && <Card>
      <SectionHeading title="Android app activity" subtitle="Daily foreground time from your device"/>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Badge state={usageAccess === 'authorized' ? 'Confirmed' : 'Unavailable'}/><Txt size={12} color={t.muted}>{usageAccess === 'authorized' ? 'Usage Access granted' : usageAccess === 'denied' ? 'Usage Access is off' : 'Native module requires a development build'}</Txt></View>
      <Txt size={12} color={t.muted} style={{ marginTop: 13, lineHeight: 20 }}>With your permission, Android provides app foreground-time totals by day. IPward does not learn what you did inside an app, how many messages you sent, or what another app recorded.</Txt>
      <View style={{ flexDirection: 'row', gap: 9, flexWrap: 'wrap', marginTop: 18 }}><Button label="Open Usage Access settings" icon="settings" variant="secondary" onPress={() => { if (!openUsageSettings()) toast('Install an Android development build to enable app activity.'); }} disabled={usageAccess === 'unsupported'}/><Button label="Refresh activity" icon="refresh-cw" variant="ghost" onPress={() => { void refreshUsage(); }}/></View>
      <InfoNote>Only apps with recorded foreground time appear. Android may report usage in calendar-day buckets that do not exactly match a custom time range. Permission can be revoked in Android Settings.</InfoNote>
    </Card>}

    <View style={{ flexDirection: twoColumns ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
      <View style={local.column}>
        <Card>
          <SectionHeading title="Make it yours" subtitle="A quieter, clearer view of your activity"/>
          <PreferenceRow icon="sun" title="Light appearance" description={settings.light ? 'A soft, bright workspace' : 'Dark appearance is active'} value={settings.light} onChange={light => updateSettings({ light })}/>
          <PreferenceRow icon="wind" title="Reduce motion" description="Keep network illustrations still. Your system preference is also respected." value={settings.reducedMotion} onChange={reducedMotion => updateSettings({ reducedMotion })}/>
          <PreferenceRow icon="code" title="Technical details" description="Show IP addresses, protocols, and other connection details." value={settings.technical} onChange={technical => updateSettings({ technical })} last/>
        </Card>

        <Card>
          <SectionHeading title="Monitoring preference" subtitle="Choose the balance that suits you"/>
          <View style={{ gap: 9 }}>{monitoringChoices.map(choice => {
            const selected = settings.monitoring === choice.name;
            return <Pressable key={choice.name} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${choice.name}. ${choice.detail}`} onPress={() => updateSettings({ monitoring: choice.name })} style={({ pressed }) => [local.monitorChoice, { backgroundColor: selected ? t.blueTint : t.surface, borderColor: selected ? t.blue : t.border, opacity: pressed ? 0.75 : 1 }]}>
              <Icon name={choice.icon} size={17} color={selected ? t.blue : t.muted}/>
              <View style={{ flex: 1 }}><Txt size={13} weight="500" color={selected ? t.blue : t.text}>{choice.name}</Txt><Txt size={11} color={t.muted} style={{ marginTop: 2 }}>{choice.detail}</Txt></View>
              <View style={{ width: 17, height: 17, borderRadius: 9, borderColor: selected ? t.blue : t.subtle, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' }}>{selected && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.blue }}/>}</View>
            </Pressable>;
          })}</View>
          <InfoNote>This preference is saved for a future authorized monitoring provider. No background monitoring is active in this build.</InfoNote>
        </Card>

        <Card>
          <SectionHeading title="Privacy by default" action="Learn more" onAction={() => navigate('Trust')}/>
          <PreferenceRow icon="lock" title="Local-only mode" description="Always on in this build. No cloud synchronization or remote monitoring service is connected." value disabled last/>
          <View style={{ borderTopWidth: 1, borderColor: t.border, marginTop: 4, paddingTop: 17, gap: 8 }}><Txt size={12} color={t.muted}>Reports leave the app only when you choose to export and share them.</Txt><Badge state="Confirmed"/></View>
        </Card>

        <Card>
          <SectionHeading title="Workspace" subtitle={mode === 'demo' ? 'You are exploring clearly labelled sample activity' : 'Your device workspace is selected'}/>
          <View style={{ flexDirection: 'row', gap: 9, flexWrap: 'wrap' }}>
            <Pill label="Sample preview" icon="eye" active={mode === 'demo'} onPress={() => { setMode('demo'); setDemoPaused(false); setConfirmDelete(null); toast('Sample workspace restored. This is illustrative activity.'); }}/>
            <Pill label="My device" icon="smartphone" active={mode === 'device'} onPress={() => { setMode('device'); setConfirmDelete(null); toast('Device workspace selected. Import a report to see available observations.'); }}/>
          </View>
          <InfoNote>{mode === 'demo' ? 'Sample events demonstrate the experience. Tap Sample preview to restore them after clearing history.' : 'Device views show your imported report, if available. Imports are historical and do not activate live monitoring.'}</InfoNote>
        </Card>
      </View>

      <View style={local.column}>
        <Card>
          <SectionHeading title="History & storage" subtitle="Keep only what you need"/>
          <Txt size={12} weight="500" style={{ marginBottom: 12 }}>Saved capture retention</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[1, 7, 30, 90, 0].map(days => <Pill key={days} label={days === 0 ? 'Forever' : `${days} ${days === 1 ? 'day' : 'days'}`} active={settings.retention === days} onPress={() => updateSettings({ retention: days })}/>)}</View>
          <Txt size={11} color={t.muted} style={{ marginTop: 13, marginBottom: 21 }}>Saved captures and imported events older than this window are removed from local storage. Bundled sample history remains available to explore.</Txt>
          <View style={{ borderTopWidth: 1, borderColor: t.border, paddingTop: 18, gap: 14 }}>
            <View style={local.between}><Txt size={12} color={t.muted}>Saved captures</Txt><Txt size={13} weight="500">{captures.length}</Txt></View>
            <View style={local.between}><Txt size={12} color={t.muted}>Imported observations</Txt><Txt size={13} weight="500">{mode === 'device' ? dataset.connections.length + dataset.sensors.length : 'Switch to My device'}</Txt></View>
            <View style={local.between}><Txt size={12} color={t.muted}>Capture payload estimate</Txt><Txt size={13} weight="500">{formatBytes(savedCaptureBytes)}</Txt></View>
            <View style={local.between}><Txt size={12} color={t.muted}>Preferences + captures</Txt><Txt size={13} weight="500">{formatBytes(storedBytes)}</Txt></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 23 }}>
            <Button label="Delete captures" icon="trash-2" variant="secondary" small onPress={() => setConfirmDelete('captures')} disabled={captures.length === 0}/>
            <Button label="Clear history" variant="danger" small onPress={() => setConfirmDelete('history')}/>
            {Platform.OS !== 'web' && <Button label="Clear temporary exports" icon="trash" variant="ghost" small onPress={clearTemporaryReports}/>}
          </View>
          {confirmDelete && <View accessibilityLiveRegion="polite" style={[local.confirmation, { backgroundColor: t.elevated, borderColor: t.border }]}>
            <Txt size={13} weight="600">{confirmDelete === 'history' ? 'Clear this workspace?' : 'Delete all saved captures?'}</Txt>
            <Txt size={12} color={t.muted} style={{ marginVertical: 9 }}>{confirmDelete === 'history' ? 'This deletes imported report observations, saved captures, and temporary report exports from app cache. Android usage totals come from the operating system and will reappear while Usage Access is granted. Preferences stay in place.' : 'Saved captures and any active capture will be removed. This cannot be undone.'}</Txt>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><Button label={confirmDelete === 'history' ? 'Confirm clear history' : 'Confirm delete captures'} variant="danger" onPress={deleteSelected} small/><Button label="Cancel" variant="secondary" onPress={() => setConfirmDelete(null)} small/></View>
          </View>}
        </Card>

        <Card>
          <SectionHeading title="Take your data with you" subtitle="Export a report from your local workspace"/>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 17 }}>
            <Pill label="Today" active={exportScope === 'Today'} onPress={() => selectScope('Today')}/>
            <Pill label="Last hour" active={exportScope === 'Live'} onPress={() => selectScope('Live')}/>
            {range !== 'Today' && range !== 'Live' && <Pill label={range} active={exportScope === range} onPress={() => selectScope(range)}/>}
            <Pill label="All loaded" active={exportScope === 'All loaded'} onPress={() => selectScope('All loaded')}/>
          </View>
          <Txt size={12} color={t.muted}>{selectedDataset.connections.length.toLocaleString()} {mode === 'device' ? 'domain records' : 'connections'} · {selectedDataset.sensors.length.toLocaleString()} {mode === 'device' ? 'sensor intervals' : 'sensor events'} · {(selectedDataset.appUsage ?? []).length.toLocaleString()} app-use days</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 17 }}><Button label="Activity JSON" icon="file-text" variant="secondary" onPress={() => { setConfirmExport('json'); setExportError(null); }} small disabled={exportBusy}/><Button label="Connections CSV" icon="download" variant="secondary" onPress={() => { setConfirmExport('csv'); setExportError(null); }} small disabled={exportBusy}/></View>
          <Txt size={11} color={t.muted} style={{ marginTop: 13 }}>JSON includes activity and captures started in the selected period. CSV includes connection rows. Every event retains its source and evidence label.</Txt>
          {confirmExport && <View accessibilityLiveRegion="polite" style={[local.confirmation, { backgroundColor: t.amberTint, borderColor: t.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="file-text" size={16} color={t.amber}/><Txt size={13} weight="600" color={t.amber}>This report contains activity metadata</Txt></View>
            <Txt size={12} color={t.muted} style={{ marginVertical: 10 }}>App names, timestamps, domains, and destinations may reveal private activity. {mode === 'demo' ? 'This workspace contains labelled sample data. ' : ''}{Platform.OS === 'web' ? 'The report will download to this device.' : 'A report file will open in your share sheet. Choose a destination you trust. A temporary copy remains in app cache.'}</Txt>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><Button label={exportBusy ? 'Preparing…' : Platform.OS === 'web' ? 'Download report' : 'Open share sheet'} icon="download" onPress={() => { void exportReport(confirmExport); }} disabled={exportBusy} small/><Button label="Cancel export" variant="ghost" onPress={() => setConfirmExport(null)} disabled={exportBusy} small/></View>
          </View>}
          {exportError && <Txt accessibilityRole="alert" size={12} color={t.red} style={{ marginTop: 14 }}>{exportError}</Txt>}
        </Card>

        <Card>
          <SectionHeading title="IPward resource use" subtitle="The same transparency, applied to us"/>
          <View style={{ gap: 18 }}>
            <View style={local.between}><View style={{ flex: 1 }}><Txt size={12}>Loaded activity payload</Txt><Txt size={10} color={t.muted}>Calculated from the local JSON representation</Txt></View><Txt size={16} weight="500" color={t.blue}>{formatBytes(loadedBytes)}</Txt></View>
            <View style={local.between}><Txt size={12}>Battery impact</Txt><Badge state="Unavailable"/></View>
            <View style={local.between}><Txt size={12}>Total app disk usage</Txt><Badge state="Unavailable"/></View>
          </View>
          <InfoNote>Payload sizes are estimates and exclude app files, caches, and storage overhead. This build cannot measure its own battery consumption.</InfoNote>
        </Card>
      </View>
    </View>
    <Txt size={10} color={t.subtle} style={{ textAlign: 'center', paddingVertical: 8 }}>IPward · Privacy, made visible.</Txt>
  </View>;
}

const local = StyleSheet.create({
  column: { flex: 1, width: '100%', gap: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 17, minHeight: 76 },
  icon: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  monitorChoice: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderWidth: 1, borderRadius: 11, minHeight: 68 },
  confirmation: { borderRadius: 11, borderWidth: 1, padding: 15, marginTop: 17 },
});
