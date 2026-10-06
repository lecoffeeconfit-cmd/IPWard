import React, { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Badge, Button, Card, EmptyState, Icon, InfoNote, Pill, SectionHeading, Txt, styles } from '../components/ui';
import { filterConnections } from '../services/analytics';
import { MAX_FOOTPRINT_EXPORT_BYTES, parseDataFootprintExport } from '../services/dataFootprint';
import { getAppPrivacyScore, getPrivacyScores, PrivacyScoreValue } from '../services/privacyScores';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';

type ViewMode = 'Map' | 'Exposure' | 'Footprints' | 'Scores';

function ScoreCard({ title, value, color }: { title: string; value: PrivacyScoreValue; color: string }) {
  const t = useTheme();
  return <View style={{ flexGrow: 1, flexBasis: 150, minWidth: 140, padding: 15, borderRadius: 15, borderWidth: 1, borderColor: t.border, backgroundColor: t.elevated }}>
    <Txt size={10} color={color} weight="700" style={{ letterSpacing: .8 }}>{title.toUpperCase()}</Txt>
    <Txt size={26} weight="600" style={{ marginTop: 4 }}>{value.score === null ? '—' : value.score}</Txt>
    <Txt size={11} color={t.muted}>{value.label}</Txt>
    <Txt size={10} color={t.subtle} style={{ marginTop: 6 }}>{value.detail}</Txt>
  </View>;
}

function GraphStep({ number, title, items, color, onPress }: { number: string; title: string; items: { id: string; label: string; detail?: string }[]; color: string; onPress?: (id: string) => void }) {
  const t = useTheme();
  return <View style={{ flex: 1, minWidth: 210, borderRadius: 16, borderWidth: 1, borderColor: t.border, backgroundColor: t.elevated, padding: 14 }}>
    <Txt size={10} color={color} weight="700" style={{ letterSpacing: 1 }}>{number} / {title.toUpperCase()}</Txt>
    <View style={{ marginTop: 8 }}>{items.length ? items.slice(0, 7).map(item => <Pressable key={item.id} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} onPress={() => onPress?.(item.id)} style={({ pressed }) => ({ paddingVertical: 9, borderTopWidth: 1, borderColor: t.border, opacity: pressed ? .65 : 1 })}><Txt size={12} weight="600" numberOfLines={2}>{item.label}{onPress ? '  ↗' : ''}</Txt>{item.detail && <Txt size={10} color={t.muted} numberOfLines={2}>{item.detail}</Txt>}</Pressable>) : <Txt size={11} color={t.muted} style={{ paddingVertical: 10 }}>No evidence in this range.</Txt>}</View>
  </View>;
}

export function PrivacyMapScreen() {
  const { dataset, mode, range, openDetail, navigate, dataFootprints, saveDataFootprint, removeDataFootprint, toast } = useApp();
  const t = useTheme();
  const [view, setView] = useState<ViewMode>('Map');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const events = useMemo(() => filterConnections(dataset, { range }), [dataset, range]);
  const appIds = new Set([...events.map(event => event.appId), ...dataset.sensors.map(event => event.appId)].filter((id): id is string => !!id));
  const apps = dataset.apps.filter(app => appIds.has(app.id));
  const activeApp = apps.find(app => app.id === selectedAppId) ?? apps[0] ?? dataset.apps[0];
  const appEvents = activeApp ? events.filter(event => event.appId === activeApp.id) : events;
  const appSensors = activeApp ? dataset.sensors.filter(event => event.appId === activeApp.id) : dataset.sensors;
  const organizationById = new Map(dataset.organizations.map(item => [item.id, item]));
  const scores = getPrivacyScores({ ...dataset, connections: events });
  const recipientItems = [...new Map(appEvents.map(event => [event.organizationId ?? event.domain, { id: event.id, label: organizationById.get(event.organizationId ?? '')?.name ?? event.domain, detail: `${event.domain} · ${event.category}` }])).values()];
  const purposeItems = [...new Set(appEvents.map(event => event.category))].map(category => ({ id: category, label: category, detail: `${appEvents.filter(event => event.category === category).length} domain records` }));
  const accessItems = [...new Set(appSensors.map(event => event.sensor))].map(sensor => ({ id: sensor, label: sensor, detail: `${appSensors.filter(event => event.sensor === sensor).length} recorded access intervals` }));
  const footprintTotals = new Map<string, number>();
  for (const item of dataFootprints) for (const category of item.categories) footprintTotals.set(category.category, (footprintTotals.get(category.category) ?? 0) + category.fields);

  async function importFootprint() {
    let pickedUri: string | null = null;
    setImportMessage('');
    try {
      const selection = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/csv', 'text/plain'], copyToCacheDirectory: true, multiple: false, base64: false });
      if (selection.canceled) return;
      const asset = selection.assets[0];
      pickedUri = asset.uri;
      if (asset.size && asset.size > MAX_FOOTPRINT_EXPORT_BYTES) throw new Error('This export exceeds the 12 MB import limit.');
      setImporting(true);
      const contents = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
      const parsed = parseDataFootprintExport(contents, asset.name);
      saveDataFootprint(parsed);
      setImportMessage(`Inventoried ${parsed.totalFields.toLocaleString()} fields across ${parsed.categories.length} categories. Raw values were not saved.`);
      toast(`${parsed.provider} export inventory saved locally.`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'The account export could not be inventoried.');
    } finally {
      if (Platform.OS !== 'web' && pickedUri?.startsWith(Paths.cache.uri)) { try { new File(pickedUri).delete(); } catch { /* Cache can be cleared in Settings. */ } }
      setImporting(false);
    }
  }

  return <View style={styles.stack}>
    <Card style={{ backgroundColor: t.cyanTint, borderColor: t.cyan }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}><View style={{ flex: 1, minWidth: 230 }}><Txt size={10} color={t.cyan} weight="700" style={{ letterSpacing: 1.6 }}>PRIVACY GRAPH / LOCAL EVIDENCE</Txt><Txt size={24} weight="600" style={{ marginTop: 7 }}>Access → app → recipient → purpose</Txt><Txt size={12} color={t.muted} style={{ marginTop: 7, lineHeight: 19 }}>Follow what IPward can actually connect, while keeping access, transmission, declared collection, and company-stored data separate.</Txt></View><View style={{ minWidth: 108 }}><Txt size={38} weight="600" color={t.cyan}>{scores.overall.score ?? '—'}</Txt><Txt size={10} color={t.muted}>Exposure score</Txt></View></View>
      <InfoNote>This score summarizes exposure visible in the current workspace. It is not a security grade, spyware verdict, or proof of what a company stored.</InfoNote>
    </Card>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{(['Map', 'Exposure', 'Footprints', 'Scores'] as ViewMode[]).map(item => <Pill key={item} label={item === 'Footprints' ? `Data footprints · ${dataFootprints.length}` : item} active={view === item} onPress={() => setView(item)}/>)}</ScrollView>

    {view === 'Map' && <>
      {apps.length > 0 && <Card><SectionHeading title="Choose an app" subtitle="The graph stays scoped to one app so the relationship remains readable"/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{apps.map(app => <Pill key={app.id} label={app.name} active={activeApp?.id === app.id} onPress={() => setSelectedAppId(app.id)}/>)}</ScrollView></Card>}
      {activeApp ? <Card><SectionHeading title={`${activeApp.name} data map`} subtitle={`${range} · ${mode === 'device' ? 'loaded historical evidence' : 'fictional sample evidence'}`}/><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
        <GraphStep number="01" title="Access" color={t.cyan} items={accessItems}/>
        <GraphStep number="02" title="App" color={activeApp.color} items={[{ id: activeApp.id, label: activeApp.name, detail: activeApp.identifier }]}/>
        <GraphStep number="03" title="Recipients" color={t.blue} items={recipientItems} onPress={id => openDetail({ type: 'connection', id })}/>
        <GraphStep number="04" title="Purpose hints" color={t.amber} items={purposeItems}/>
      </View><InfoNote>A resource access and a network contact are separate observations. Their appearance in one graph does not prove the accessed content was transmitted to that recipient.</InfoNote></Card> : <EmptyState title="Your privacy graph starts with evidence" description={mode === 'device' ? 'Import an Apple App Privacy Report in Settings, or grant Android Usage Access where available.' : 'Choose a time range containing sample activity.'} icon="share-2" action={mode === 'device' ? 'Open settings' : undefined} onAction={mode === 'device' ? () => navigate('Settings') : undefined}/>} 
    </>}

    {view === 'Exposure' && <>
      <Card><SectionHeading title="Four different claims" subtitle="IPward keeps these evidence levels separate"/>{[
        { title: 'Observed leaving device', color: t.blue, icon: 'arrow-up-right' as const, value: `${events.length} destination records`, detail: 'IPward saw or imported a network contact. Payload contents remain unavailable.' },
        { title: 'Potentially collected', color: t.amber, icon: 'eye' as const, value: `${new Set(dataset.apps.flatMap(app => app.permissions.map(permission => permission.sensor))).size} permission categories`, detail: 'A permission or technical capability makes collection possible; it does not prove use.' },
        { title: 'Declared collected', color: t.purple, icon: 'file-text' as const, value: 'No privacy labels loaded', detail: 'Developer disclosures require a reviewed metadata source and remain separate from observed behavior.' },
        { title: 'Found in account export', color: t.cyan, icon: 'archive' as const, value: `${dataFootprints.reduce((sum, item) => sum + item.totalFields, 0).toLocaleString()} field occurrences`, detail: 'Field names found in files you selected. This is evidence from the export, not a live server inventory.' },
      ].map((item, index) => <View key={item.title} style={{ flexDirection: 'row', gap: 12, paddingVertical: 15, borderTopWidth: index ? 1 : 0, borderColor: t.border }}><View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.elevated, alignItems: 'center', justifyContent: 'center' }}><Icon name={item.icon} color={item.color}/></View><View style={{ flex: 1 }}><Txt size={13} weight="700">{item.title}</Txt><Txt size={16} color={item.color} weight="600" style={{ marginTop: 2 }}>{item.value}</Txt><Txt size={11} color={t.muted} style={{ marginTop: 4 }}>{item.detail}</Txt></View></View>)}</Card>
      <Card><SectionHeading title="Information categories in scope" subtitle="Observed access and account-export inventory"/><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>{[...new Set([...dataset.sensors.map(event => event.sensor), ...footprintTotals.keys()])].map(category => <View key={category} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border }}><Txt size={11}>{category}</Txt></View>)}</View>{!dataset.sensors.length && !footprintTotals.size && <Txt size={12} color={t.muted}>No sensor-access or account-export categories are loaded yet.</Txt>}</Card>
      <Card><SectionHeading title="Data source catalog" subtitle="What mobile apps and services may request or infer"/><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>{[
        ['Sensors & surroundings', 'Camera · microphone · precise/approximate location · Bluetooth · local network · motion · speech · nearby devices · Home'],
        ['Personal libraries', 'Photos · contacts · calendars · reminders · files · clipboard · health and fitness'],
        ['Device capabilities', 'Notifications · background location · screen recording · biometrics access prompts · network state'],
        ['Identifiers & behavior', 'IP address · device/app identifiers · account IDs · searches · browsing · purchases · inferred interests'],
      ].map(([title, detail]) => <View key={title} style={{ flexGrow: 1, flexBasis: 230, minWidth: 210, padding: 13, borderRadius: 13, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border }}><Txt size={12} weight="700">{title}</Txt><Txt size={10} color={t.muted} style={{ marginTop: 4 }}>{detail}</Txt></View>)}</View><InfoNote>iOS and Android do not give an ordinary app a complete live inventory of every other app’s permissions. IPward shows imported access evidence and guides you to system controls without pretending unavailable switches were read.</InfoNote></Card>
    </>}

    {view === 'Footprints' && <>
      <Card><SectionHeading title="Personal data footprint" subtitle="Inventory files from a company data export without retaining their raw values"/><Txt size={12} color={t.muted} style={{ lineHeight: 19 }}>Request your data from Google, Meta, TikTok, X, Microsoft, Apple, or another company. After downloading it, choose an individual JSON, NDJSON, or CSV file here. ZIP archives are not opened by this build.</Txt><View style={{ alignSelf: 'flex-start', marginTop: 16 }}><Button label={importing ? 'Reading locally…' : 'Choose export file'} icon="upload" onPress={() => { void importFootprint(); }} disabled={importing}/></View>{!!importMessage && <Txt accessibilityLiveRegion="polite" size={11} color={t.cyan} style={{ marginTop: 10 }}>{importMessage}</Txt>}<InfoNote>IPward stores category totals and example field paths only. It discards values such as names, messages, searches, locations, and account identifiers after analysis.</InfoNote></Card>
      <Card><SectionHeading title="Data request & deletion assistant" subtitle="Export first, review dependencies, then use the company’s own controls"/>{[
        ['1', 'Request a copy', 'Use the provider’s official privacy or account settings. Choose JSON or CSV when offered.'],
        ['2', 'Protect the archive', 'Account exports can contain messages, locations, contacts, photos, and identifiers. Keep them in trusted storage.'],
        ['3', 'Inventory selected files', 'Open the archive yourself, then choose individual JSON, NDJSON, or CSV files above.'],
        ['4', 'Decide what to remove', 'Review subscriptions, purchases, sign-in dependencies, recovery methods, and data you need before deletion.'],
      ].map(([number, title, detail]) => <View key={number} style={{ flexDirection: 'row', gap: 11, paddingVertical: 11 }}><View style={{ width: 27, height: 27, borderRadius: 14, backgroundColor: t.cyanTint, alignItems: 'center', justifyContent: 'center' }}><Txt size={11} color={t.cyan} weight="700">{number}</Txt></View><View style={{ flex: 1 }}><Txt size={12} weight="700">{title}</Txt><Txt size={10} color={t.muted}>{detail}</Txt></View></View>)}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}><Button small label="Google export guide" icon="external-link" variant="secondary" onPress={() => { void Linking.openURL('https://support.google.com/accounts/answer/3024190').catch(() => toast('The Google guide could not be opened.')); }}/><Button small label="Apple data controls" icon="external-link" variant="secondary" onPress={() => { void Linking.openURL('https://support.apple.com/102283').catch(() => toast('The Apple guide could not be opened.')); }}/><Button small label="Meta deletion guide" icon="external-link" variant="secondary" onPress={() => { void Linking.openURL('https://www.facebook.com/help/224562897555674').catch(() => toast('The Meta guide could not be opened.')); }}/></View><InfoNote>IPward never submits an account deletion request for you. Deletion can be irreversible and may affect sign-in to other apps, purchases, subscriptions, and recovery options.</InfoNote></Card>
      {dataFootprints.map(item => <Card key={item.id}><View style={styles.between}><View style={{ flex: 1 }}><View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Badge state="Confirmed"/><Txt size={10} color={t.muted}>USER-SELECTED EXPORT</Txt></View><Txt size={18} weight="700" style={{ marginTop: 8 }}>{item.provider}</Txt><Txt size={11} color={t.muted}>{item.fileName} · {item.format.toUpperCase()} · {new Date(item.importedAt).toLocaleString()}</Txt></View><Button small label="Remove" icon="trash-2" variant="ghost" onPress={() => removeDataFootprint(item.id)}/></View><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 }}>{item.categories.map(category => <View key={category.category} style={{ minWidth: 145, flexGrow: 1, flexBasis: 180, padding: 12, borderRadius: 12, backgroundColor: t.elevated }}><Txt size={12} weight="600">{category.category}</Txt><Txt size={19} color={t.cyan} weight="600">{category.fields.toLocaleString()}</Txt><Txt size={9} color={t.subtle} numberOfLines={2}>{category.examplePaths.join(' · ')}</Txt></View>)}</View><InfoNote>Found in this export file does not prove the company still stores every field now. Export coverage and timestamps vary by provider.</InfoNote></Card>)}
      {!dataFootprints.length && <EmptyState title="No account exports inventoried" description="Choose an individual JSON, NDJSON, or CSV file from a data export to build a local category inventory." icon="archive"/>}
    </>}

    {view === 'Scores' && <>
      <Card><SectionHeading title="Privacy exposure scores" subtitle="Higher means lower visible exposure; missing evidence stays blank"/><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}><ScoreCard title="Overall" value={scores.overall} color={t.cyan}/><ScoreCard title="Network privacy" value={scores.networkPrivacy} color={t.blue}/><ScoreCard title="Tracking exposure" value={scores.trackingExposure} color={t.amber}/><ScoreCard title="Permission exposure" value={scores.permissionExposure} color={t.purple}/><ScoreCard title="Evidence coverage" value={scores.evidenceCoverage} color={t.cyan}/></View><InfoNote>Scores organize visible evidence. They do not attest device integrity, compare against every app’s privacy label, or prove a device is clean.</InfoNote></Card>
      <Card><SectionHeading title="App exposure profiles" subtitle="Recipients, tracker-related destinations, and recorded resource types"/>{apps.map(app => { const score = getAppPrivacyScore({ ...dataset, connections: events }, app.id); return <Pressable key={app.id} accessibilityRole="button" onPress={() => openDetail({ type: 'app', id: app.id })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderTopWidth: 1, borderColor: t.border, opacity: pressed ? .65 : 1 })}><View style={{ width: 37, height: 37, borderRadius: 12, backgroundColor: app.color, alignItems: 'center', justifyContent: 'center' }}><Txt size={11} weight="700" color="#08120B">{app.initials}</Txt></View><View style={{ flex: 1 }}><Txt size={13} weight="700">{app.name}</Txt><Txt size={10} color={t.muted}>{score.detail}</Txt></View><Txt size={20} color={score.score !== null && score.score < 60 ? t.amber : t.cyan}>{score.score ?? '—'}</Txt><Icon name="chevron-right" size={15}/></Pressable>; })}{!apps.length && <Txt size={12} color={t.muted}>No app evidence is available in this range.</Txt>}</Card>
    </>}
  </View>;
}
