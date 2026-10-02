import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Badge, Button, Card, EmptyState, InfoNote, Pill, SectionHeading, Txt, styles } from '../components/ui';
import { filterByRange } from '../services/analytics';
import { controlInstructions, controlPlatform, openAndroidControlSettings, privacyControls, PrivacyControl, sensorControls } from '../services/privacyControls';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';

type TimelineFilter = 'All records' | 'Data access' | 'Domain contacts' | 'Potential cross-app';
const filters: TimelineFilter[] = ['All records', 'Data access', 'Domain contacts', 'Potential cross-app'];
const when = (value: number) => new Date(value).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function DataAdsScreen() {
  const { dataset, mode, range, navigate, openDetail, toast } = useApp();
  const t = useTheme();
  const [filter, setFilter] = useState<TimelineFilter>('All records');
  const [limit, setLimit] = useState(30);
  const [control, setControl] = useState<PrivacyControl>('Microphone');
  const [sensorFocus, setSensorFocus] = useState<PrivacyControl | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [onlyAppId, setOnlyAppId] = useState<string | null>(null);
  const [controlQuery, setControlQuery] = useState('');
  const connections = useMemo(() => filterByRange(dataset.connections, range, dataset.generatedAt), [dataset, range]);
  const sensors = useMemo(() => filterByRange(dataset.sensors, range, dataset.generatedAt), [dataset, range]);
  const appById = useMemo(() => new Map(dataset.apps.map(app => [app.id, app])), [dataset.apps]);
  const ownerById = useMemo(() => new Map(dataset.organizations.map(owner => [owner.id, owner])), [dataset.organizations]);
  const appsWithRecords = useMemo(() => {
    const ids = new Set([...connections.map(event => event.appId), ...sensors.map(event => event.appId)]);
    return dataset.apps.filter(app => ids.has(app.id));
  }, [dataset.apps, connections, sensors]);
  const controlApps = useMemo(() => dataset.apps.filter(app => `${app.name} ${app.identifier}`.toLowerCase().includes(controlQuery.trim().toLowerCase())).slice(0, 20), [dataset.apps, controlQuery]);
  const selectedApp = mode === 'device' && selectedAppId ? appById.get(selectedAppId) : undefined;
  const sourcePlatform = controlPlatform(selectedApp);
  const canOpenAndroid = Platform.OS === 'android' && sourcePlatform === 'android';
  const flagged = connections.filter(event => mode === 'device' ? event.potentialTracker : ['Advertising', 'Analytics', 'Attribution', 'Marketing'].includes(event.category));
  const timeline = useMemo(() => [
    ...connections.map(event => ({ kind: 'contact' as const, event })),
    ...sensors.map(event => ({ kind: 'access' as const, event })),
  ].sort((a, b) => b.event.timestamp - a.event.timestamp), [connections, sensors]);
  const visible = timeline.filter(item => (!onlyAppId || item.event.appId === onlyAppId) && (!sensorFocus || item.kind === 'access' && item.event.sensor === sensorFocus) && (
    filter === 'All records' || filter === 'Data access' && item.kind === 'access' || filter === 'Domain contacts' && item.kind === 'contact' || filter === 'Potential cross-app' && item.kind === 'contact' && (mode === 'device' ? item.event.potentialTracker : ['Advertising', 'Analytics', 'Attribution', 'Marketing'].includes(item.event.category))
  ));

  function chooseControl(next: PrivacyControl, appId: string | null = selectedAppId) {
    setControl(next);
    setSelectedAppId(mode === 'device' ? appId : null);
    setSensorFocus(null);
  }

  return <View style={styles.stack}>
    <Card style={{ backgroundColor: t.blueTint }}>
      <SectionHeading title="What your phone can show" subtitle={mode === 'device' ? connections.length || sensors.length ? 'Historical, user-imported Apple report' : 'Import an Apple report to see historical records' : 'Fictional sample preview'} />
      <Txt size={13} color={t.muted}>{mode === 'device'
        ? 'IPward can show which app accessed a resource, its recorded interval, and which domains an app contacted. An Apple domain row gives the latest contact time and an aggregate count.'
        : 'These records demonstrate the view. They were not gathered from your phone.'}</Txt>
      <InfoNote>Spoken words, typed text, photos viewed, network payloads, which ad appeared, the app that received an ad, and why it was chosen are unavailable. A domain contact or microphone access does not establish that any of those contents were gathered or used for advertising.</InfoNote>
    </Card>

    <View style={styles.wrap}>
      <Card style={{ flex: 1, minWidth: 145, padding: 17 }}><Txt size={25} weight="600" color={t.cyan}>{sensors.length}</Txt><Txt size={12}>Resource access intervals</Txt><Txt size={10} color={t.muted}>{mode === 'device' ? sensors.length ? 'From imported report' : 'No intervals in range' : 'Sample only'}</Txt></Card>
      <Card style={{ flex: 1, minWidth: 145, padding: 17 }}><Txt size={25} weight="600" color={t.blue}>{connections.length}</Txt><Txt size={12}>Domain records</Txt><Txt size={10} color={t.muted}>{mode === 'device' ? connections.length ? 'Latest contact shown' : 'No contacts in range' : 'Sample only'}</Txt></Card>
      <Card style={{ flex: 1, minWidth: 145, padding: 17 }}><Txt size={25} weight="600" color={t.amber}>{flagged.length}</Txt><Txt size={12}>{mode === 'device' ? 'Potential cross-app flags' : 'Ad / analytics examples'}</Txt><Txt size={10} color={t.muted}>Purpose unverified</Txt></Card>
    </View>

    <Card>
      <SectionHeading title="What was accessed" subtitle="Pick a data type to review its records and controls" />
      <View style={styles.wrap}>{sensorControls.map(type => {
        const count = sensors.filter(event => event.sensor === type).length;
        return <Pill key={type} label={`${type} · ${count}`} active={sensorFocus === type} onPress={() => { chooseControl(type); setSensorFocus(type); setFilter('Data access'); setLimit(30); }} />;
      })}</View>
      <Txt size={12} color={t.muted} style={{ marginTop: 16 }}>A recorded access interval shows when an app used the resource. It does not contain the resource’s content or prove it was uploaded.</Txt>
    </Card>

    <Card>
      <SectionHeading title="Choose what apps may access" subtitle="Change the phone’s permission for a specific data type" />
      <View style={styles.wrap}>{privacyControls.map(item => <Pill key={item} label={item} active={control === item} onPress={() => chooseControl(item)} />)}</View>
      {mode === 'device' && !!dataset.apps.length && <><TextInput accessibilityLabel="Find app for privacy controls" placeholder="Find an app to change its permissions" placeholderTextColor={t.subtle} value={controlQuery} onChangeText={setControlQuery} style={{ minHeight: 45, marginTop: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: t.border, borderRadius: 10, color: t.text }} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 15 }}><Pill label="Any app" active={!selectedAppId} onPress={() => setSelectedAppId(null)} />{controlApps.map(app => <Pill key={app.id} label={app.name} active={selectedAppId === app.id} onPress={() => setSelectedAppId(app.id)} />)}</ScrollView>{!controlApps.length && <Txt size={11} color={t.muted}>No matching app in the available records.</Txt>}</>}
      <Txt size={14} weight="600" style={{ marginTop: 16 }}>{selectedApp?.name ?? 'The app you choose'} · {control}</Txt>
      <Txt size={12} color={t.muted} style={{ marginTop: 8 }}>{controlInstructions(control, selectedApp?.name ?? 'the app', sourcePlatform)}</Txt>
      {selectedApp?.source === 'user-import' && Platform.OS === 'android' && <Txt size={11} color={t.amber} style={{ marginTop: 9 }}>This record came from an Apple device. Change its permissions on that device.</Txt>}
      {mode === 'demo' && <Txt size={11} color={t.amber} style={{ marginTop: 9 }}>Sample app names are fictional examples. Choose the real app in your phone’s Settings.</Txt>}
      {canOpenAndroid && <View style={{ marginTop: 16, alignSelf: 'flex-start' }}><Button label={selectedApp?.source === 'device-activity' ? 'Open app settings' : 'Open Android privacy settings'} icon="settings" onPress={() => { void openAndroidControlSettings(selectedApp).then(opened => { if (!opened) toast('Android Settings could not be opened. Follow the steps above manually.'); }); }} /></View>}
      <InfoNote>IPward cannot change another app’s permissions or verify the current switch position. Changing a permission limits future access; it does not erase data an app may already have. Ad and tracking choices may also be inside each app.</InfoNote>
    </Card>

    <Card>
      <SectionHeading title="Where apps connected" subtitle={mode === 'device' ? 'Domain and owner labels from Apple’s report' : 'Illustrative destinations'} />
      {flagged.length ? flagged.slice(0, 8).map(event => {
        const app = appById.get(event.appId ?? '');
        const owner = ownerById.get(event.organizationId ?? '');
        return <Pressable key={event.id} accessibilityRole="button" onPress={() => openDetail({ type: 'connection', id: event.id })} style={({ pressed }) => ({ borderTopWidth: 1, borderColor: t.border, paddingVertical: 14, opacity: pressed ? 0.7 : 1 })}>
          <Txt size={13} weight="600">{app?.name ?? 'Unattributed app'} → {event.domain}</Txt>
          <Txt size={11} color={t.muted}>{mode === 'device' ? 'Reported owner' : 'Example organization'}: {owner?.name ?? 'Unknown'} · {mode === 'device' ? `Latest contact: ${when(event.timestamp)}` : when(event.timestamp)}</Txt>
          <Txt size={11} color={t.amber}>{mode === 'device' ? 'Apple potential cross-app collection flag' : `${event.category} · sample classification`}</Txt>
        </Pressable>;
      }) : <Txt size={12} color={t.muted}>No flagged domains in this time range. Open all domain contacts below to see the available destinations.</Txt>}
      <InfoNote>The domain is a network destination, not the app where an advertisement appeared. IPward cannot identify ad recipients or say which data was sent. An Apple flag signals possible cross-app collection, not confirmed ad use.</InfoNote>
    </Card>

    <Card>
      <SectionHeading title="When it was picked up" subtitle={`${visible.length} records · ${range} · times shown in your local timezone`} />
      {appsWithRecords.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 13 }}><Pill label="All apps" active={!onlyAppId} onPress={() => { setOnlyAppId(null); setLimit(30); }} />{appsWithRecords.map(app => <Pill key={app.id} label={app.name} active={onlyAppId === app.id} onPress={() => { setOnlyAppId(app.id); setSelectedAppId(app.id); setLimit(30); }} />)}</ScrollView>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>{filters.map(item => <Pill key={item} label={item} active={filter === item && !sensorFocus} onPress={() => { setSensorFocus(null); setFilter(item); setLimit(30); }} />)}</ScrollView>
      {visible.slice(0, limit).map(item => {
        const app = appById.get(item.event.appId ?? '');
        const isAccess = item.kind === 'access';
        const detail = isAccess ? item.event.sensor : item.event.domain;
        const secondary = isAccess
          ? `${when(item.event.timestamp)} → ${when(item.event.timestampEnd)} · content unavailable`
          : item.event.source === 'user-import'
            ? `Latest contact ${when(item.event.timestamp)} · ${item.event.reportHits ?? 1} contacts in report window`
            : `${when(item.event.timestamp)} · sample event`;
        return <View key={`${item.kind}-${item.event.id}`} style={{ borderTopWidth: 1, borderColor: t.border, paddingVertical: 15, gap: 5 }}>
          <Txt size={13} weight="600">{app?.name ?? 'Unattributed app'} · {isAccess ? `${detail} access` : `Contacted ${detail}`}</Txt>
          <Txt size={11} color={t.muted}>{secondary}</Txt>
          {!isAccess && <Txt size={11} color={t.muted}>{mode === 'device' ? 'Reported owner' : 'Example organization'}: {ownerById.get(item.event.organizationId ?? '')?.name ?? 'Unknown'} · Contents sent: unknown</Txt>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 }}><Badge state={item.event.provenance.state}/>{!isAccess && <Button small label="Details" variant="ghost" onPress={() => openDetail({ type: 'connection', id: item.event.id })}/ >}{isAccess && <Button small label="Select controls ↑" variant="ghost" onPress={() => { chooseControl(item.event.sensor, item.event.appId); toast('Selected this data type. Scroll up to review its phone controls.'); }}/>}</View>
        </View>;
      })}
      {!visible.length && <EmptyState title="No matching records" description={mode === 'device' ? 'Import an Apple App Privacy Report, choose a wider time range, or change the filters.' : 'Change the time range or filters to explore the sample.'} icon="clock" action={mode === 'device' ? 'Import report' : undefined} onAction={mode === 'device' ? () => navigate('Settings') : undefined} />}
      {visible.length > limit && <Button label={`Show more · ${visible.length - limit} remaining`} variant="secondary" onPress={() => setLimit(value => value + 30)} />}
    </Card>


  </View>;
}
