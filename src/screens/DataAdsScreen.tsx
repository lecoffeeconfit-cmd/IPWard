import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Badge, Button, Card, EmptyState, Icon, InfoNote, Pill, SectionHeading, Txt, styles } from '../components/ui';
import { filterByRange, formatDuration } from '../services/analytics';
import { estimateTimingClue } from '../services/privacyInference';
import { controlInstructions, controlPlatform, openAndroidControlSettings, privacyControls, PrivacyControl, sensorControls } from '../services/privacyControls';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { ChartPanel, HorizontalBarChart, HourlyBarChart } from '../components/DashboardCharts';
import { ModalityExplorer } from '../components/ModalityExplorer';
import { resourceMeaning } from '../services/modalityInsights';
import { RecalledOrigin } from '../types';

type TimelineFilter = 'All records' | 'Data access' | 'Domain contacts' | 'Potential cross-app';
const filters: TimelineFilter[] = ['All records', 'Data access', 'Domain contacts', 'Potential cross-app'];
const when = (value: number) => new Date(value).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function DataAdsScreen() {
  const { dataset, mode, range, navigate, openDetail, toast, adSightings, addAdSighting, removeAdSighting } = useApp();
  const t = useTheme();
  const [filter, setFilter] = useState<TimelineFilter>('All records');
  const [limit, setLimit] = useState(30);
  const [control, setControl] = useState<PrivacyControl>('Microphone');
  const [sensorFocus, setSensorFocus] = useState<PrivacyControl | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [onlyAppId, setOnlyAppId] = useState<string | null>(null);
  const [controlQuery, setControlQuery] = useState('');
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [showAllApps, setShowAllApps] = useState(false);
  const [adAppName, setAdAppName] = useState('');
  const [adWording, setAdWording] = useState('');
  const [adOrigin, setAdOrigin] = useState<RecalledOrigin>('unsure');
  const [adTopics, setAdTopics] = useState('');
  const [adError, setAdError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [showAllSightings, setShowAllSightings] = useState(false);
  const connections = useMemo(() => filterByRange(dataset.connections, range, dataset.generatedAt), [dataset, range]);
  const sensors = useMemo(() => filterByRange(dataset.sensors, range, dataset.generatedAt), [dataset, range]);
  const appById = useMemo(() => new Map(dataset.apps.map(app => [app.id, app])), [dataset.apps]);
  const ownerById = useMemo(() => new Map(dataset.organizations.map(owner => [owner.id, owner])), [dataset.organizations]);
  const appsWithRecords = useMemo(() => {
    const ids = new Set([...connections.map(event => event.appId), ...sensors.map(event => event.appId)]);
    return dataset.apps.filter(app => ids.has(app.id));
  }, [dataset.apps, connections, sensors]);
  const journeys = useMemo(() => appsWithRecords.map(app => {
    const contacts = connections.filter(event => event.appId === app.id).sort((a, b) => b.timestamp - a.timestamp);
    const accesses = sensors.filter(event => event.appId === app.id).sort((a, b) => b.timestamp - a.timestamp);
    const flags = contacts.filter(event => mode === 'device' ? event.potentialTracker : ['Advertising', 'Analytics', 'Attribution', 'Marketing'].includes(event.category));
    return { app, contacts, accesses, flags, latest: Math.max(contacts[0]?.timestamp ?? 0, accesses[0]?.timestamp ?? 0) };
  }).sort((a, b) => b.flags.length - a.flags.length || b.latest - a.latest), [appsWithRecords, connections, sensors, mode]);
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
  const hourly = Array.from({ length: 24 }, (_, hour) => timeline.filter(item => new Date(item.event.timestamp).getHours() === hour).length);
  const signalRows = [
    { id: 'access', label: 'Resource access intervals', value: sensors.length, detail: 'Sensor access records', color: t.cyan },
    { id: 'contacts', label: 'Domain contacts', value: connections.length, detail: 'Network destination records', color: t.blue },
    { id: 'flags', label: mode === 'device' ? 'Potential cross-app flags' : 'Ad / analytics examples', value: flagged.length, detail: 'Purpose remains unverified', color: t.amber },
  ].filter(row => row.value > 0);
  const journeyRows = journeys.slice(0, 6).map(({ app, contacts, accesses, flags }) => ({ id: app.id, label: app.name, value: contacts.length + accesses.length, detail: `${contacts.length} contacts · ${accesses.length} accesses · ${flags.length} flags`, color: flags.length ? t.amber : app.color }));

  function chooseControl(next: PrivacyControl, appId: string | null = selectedAppId) {
    setControl(next);
    setSelectedAppId(mode === 'device' ? appId : null);
    setSensorFocus(null);
  }
  function logSighting() {
    if (!adAppName.trim() || !adWording.trim()) { setAdError('Enter the app where you saw the ad and the wording or topic you noticed.'); return; }
    const topics = adTopics.split(/[,\n]/).map(topic => topic.trim()).filter(Boolean);
    if (topics.length > 10 || topics.some(topic => topic.length > 40)) { setAdError('Enter up to 10 comma-separated words or topics, each 40 characters or fewer.'); return; }
    addAdSighting(adAppName, adWording, adOrigin, topics);
    setAdAppName(''); setAdWording(''); setAdTopics(''); setAdOrigin('unsure'); setAdError('');
    toast('Your own ad observation was saved locally. IPward did not detect or verify it.');
  }

  return <View style={styles.stack}>
    <Card style={{ backgroundColor: t.blueTint }}>
      <SectionHeading title="What your phone can show" subtitle={mode === 'device' ? connections.length || sensors.length ? 'Historical, user-imported Apple report' : 'Import an Apple report to see historical records' : 'Fictional sample preview'} />
      <Txt size={13} color={t.muted}>{mode === 'device'
        ? 'IPward can show which app accessed a resource, its recorded interval, and which domains an app contacted. Apple domain rows can give the first and latest contact times plus an aggregate count; intermediate contact times are not included.'
        : 'These records demonstrate the view. They were not gathered from your phone.'}</Txt>
      <InfoNote>Spoken words, typed text, photos viewed, network payloads, which ad appeared, the app that received an ad, and why it was chosen are unavailable. A domain contact or microphone access does not establish that any of those contents were gathered or used for advertising.</InfoNote>
      {(mode === 'demo' || !connections.length && !sensors.length) && <View style={{ alignSelf: 'flex-start', marginTop: 12 }}><Button label="Import Apple report for timing clues" icon="file-text" variant="secondary" small onPress={() => navigate('Settings')}/></View>}
    </Card>

    <View style={styles.wrap}>
      <Card style={{ flex: 1, minWidth: 145, padding: 17 }}><Txt size={25} weight="600" color={t.cyan}>{sensors.length}</Txt><Txt size={12}>Resource access intervals</Txt><Txt size={10} color={t.muted}>{mode === 'device' ? sensors.length ? 'From imported report' : 'No intervals in range' : 'Sample only'}</Txt></Card>
      <Card style={{ flex: 1, minWidth: 145, padding: 17 }}><Txt size={25} weight="600" color={t.blue}>{connections.length}</Txt><Txt size={12}>Domain records</Txt><Txt size={10} color={t.muted}>{mode === 'device' ? connections.length ? 'Latest contact shown' : 'No contacts in range' : 'Sample only'}</Txt></Card>
      <Card style={{ flex: 1, minWidth: 145, padding: 17 }}><Txt size={25} weight="600" color={t.amber}>{flagged.length}</Txt><Txt size={12}>{mode === 'device' ? 'Potential cross-app flags' : 'Ad / analytics examples'}</Txt><Txt size={10} color={t.muted}>Purpose unverified</Txt></Card>
    </View>
    <ModalityExplorer apps={dataset.apps} sensors={sensors} connections={connections} adSightings={adSightings} mode={mode} onOpenConnection={id => openDetail({ type: 'connection', id })}/>
    {!!timeline.length && <Card><SectionHeading title="Data signal graphs" subtitle="Access, contacts, and flagged signals shown as separate evidence"/><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><ChartPanel title="RECORDS BY HOUR" subtitle={`${range} · local device time`} color={t.purple}><HourlyBarChart values={hourly} color={t.purple} accessibilityLabel={`${timeline.length} data and network records distributed by hour.`}/></ChartPanel><ChartPanel title="AVAILABLE SIGNALS" subtitle="Separate evidence types" color={t.blue}><HorizontalBarChart rows={signalRows} color={t.blue} onPress={row => { setSensorFocus(null); setFilter(row.id === 'access' ? 'Data access' : row.id === 'contacts' ? 'Domain contacts' : 'Potential cross-app'); setLimit(30); }}/></ChartPanel><ChartPanel title="APP SIGNAL CONCENTRATION" subtitle="Contacts and access intervals by app" color={t.cyan}><HorizontalBarChart rows={journeyRows} color={t.cyan} onPress={row => setExpandedAppId(row.id)}/></ChartPanel></View><InfoNote>The three signal types are not interchangeable. A nearby access and contact do not prove that accessed data was sent, used for advertising, or contained in a payload.</InfoNote></Card>}

    <Card>
      <SectionHeading title="Data journey by app" subtitle="Access, network contact, and possible ad signals shown as separate facts" />
      <InfoNote>A resource access and a nearby domain contact do not prove that the accessed data was sent there. Actual contents, collection reason, and ad targeting remain unknown.</InfoNote>
      {journeys.slice(0, showAllApps ? journeys.length : 4).map(({ app, contacts, accesses, flags }) => {
        const expanded = expandedAppId === app.id;
        const newestFlag = flags[0];
        const timingClue = newestFlag ? estimateTimingClue(newestFlag, accesses) : null;
        return <View key={app.id} style={{ borderTopWidth: 1, borderColor: t.border, paddingVertical: 5 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${app.name}: ${accesses.length} resource accesses, ${contacts.length} domain records, ${flags.length} possible ad signals`} onPress={() => setExpandedAppId(expanded ? null : app.id)} style={({ pressed }) => ({ minHeight: 75, flexDirection: 'row', alignItems: 'center', gap: 11, opacity: pressed ? 0.7 : 1 })}>
            <View style={{ width: 39, height: 39, alignItems: 'center', justifyContent: 'center', backgroundColor: flags.length ? t.amberTint : t.cyanTint, borderTopLeftRadius: 15, borderTopRightRadius: 6, borderBottomRightRadius: 15, borderBottomLeftRadius: 6 }}><Icon name={flags.length ? 'target' : 'activity'} size={18} color={flags.length ? t.amber : t.cyan}/></View>
            <View style={{ flex: 1 }}><Txt size={14} weight="700">{app.name}</Txt><Txt size={10} color={t.muted}>{accesses.length} accesses · {contacts.length} domain records · {flags.length} {mode === 'device' ? 'cross-app flags' : 'ad/analytics examples'}</Txt></View>
            <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={t.blue}/>
          </Pressable>
          {expanded && <View style={{ gap: 13, paddingBottom: 16, paddingLeft: 8 }}>
            <View style={{ padding: 12, backgroundColor: t.elevated, borderRadius: 12 }}><Txt size={10} color={t.cyan} weight="700" style={{ letterSpacing: 1.2 }}>01 / DATA ACCESS</Txt>{accesses.length ? accesses.slice(0, 3).map(event => <Txt key={event.id} size={11} style={{ marginTop: 6 }}>{event.sensor} · {when(event.timestamp)}–{new Date(event.timestampEnd).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {formatDuration((event.timestampEnd - event.timestamp) / 1000)} access</Txt>) : <Txt size={11} color={t.muted} style={{ marginTop: 6 }}>No resource access recorded in this range.</Txt>}<Txt size={10} color={t.muted} style={{ marginTop: 7 }}>Method: {mode === 'device' ? 'Apple report access interval' : 'Illustrative sample event'} · Content: unavailable{accesses.length > 3 ? ' · Latest 3 shown' : ''}</Txt></View>
            <View style={{ padding: 12, backgroundColor: t.elevated, borderRadius: 12 }}><Txt size={10} color={t.blue} weight="700" style={{ letterSpacing: 1.2 }}>02 / NETWORK DESTINATIONS</Txt>{contacts.length ? contacts.slice(0, 3).map(event => <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`Open details for ${event.domain}`} onPress={() => openDetail({ type: 'connection', id: event.id })} style={{ paddingTop: 8 }}><Txt size={11} weight="600">{event.domain} ↗</Txt><Txt size={10} color={t.muted}>{mode === 'device' ? `${event.reportFirstAt ? `First in report ${when(event.reportFirstAt)} · ` : ''}Latest ${when(event.timestamp)} · ${event.reportHits ?? 1} reported contacts` : `${when(event.timestamp)} · sample connection`}</Txt><Txt size={10} color={t.muted}>{mode === 'device' ? 'Provider label' : 'Example owner'}: {ownerById.get(event.organizationId ?? '')?.name ?? 'Unknown'}</Txt></Pressable>) : <Txt size={11} color={t.muted} style={{ marginTop: 6 }}>No domain contacts recorded in this range.</Txt>}<Txt size={10} color={t.muted} style={{ marginTop: 7 }}>Method: {mode === 'device' ? 'Apple report aggregate; intermediate contact times unknown' : 'Illustrative sample'} · Data sent: unknown{contacts.length > 3 ? ' · Latest 3 shown' : ''}</Txt></View>
            <View style={{ padding: 12, backgroundColor: flags.length ? t.amberTint : t.elevated, borderRadius: 12 }}><Txt size={10} color={t.amber} weight="700" style={{ letterSpacing: 1.2 }}>03 / POSSIBLE USE & TIMING</Txt><Txt size={11} color={t.text} style={{ marginTop: 6 }}>{flags.length ? mode === 'device' ? `${flags.length} domain ${flags.length === 1 ? 'row has' : 'rows have'} Apple's potential cross-app collection flag. Possible profiling use; low confidence for this app.` : `${flags.length} sample endpoints have ad, analytics, or attribution categories.` : 'No flagged domain in this range.'}</Txt>{mode === 'device' && newestFlag && <><Txt size={10} color={t.muted} style={{ marginTop: 7 }}>Latest flagged contact: {newestFlag.domain} · {when(newestFlag.timestamp)}{newestFlag.reportFirstAt ? ` · first in report ${when(newestFlag.reportFirstAt)}` : ''}</Txt><Txt size={10} color={t.muted} style={{ marginTop: 6 }}>{timingClue ? `Low-confidence timing clue: ${timingClue.sensor.sensor} access ${when(timingClue.sensor.timestamp)}–${when(timingClue.sensor.timestampEnd)} ${timingClue.relation === 'overlap' ? 'overlapped' : timingClue.relation === 'before' ? 'ended before' : 'began after'} that latest contact${timingClue.gapMs ? ` by about ${Math.ceil(timingClue.gapMs / 60_000)} min` : ''}.` : 'No matching access in the loaded workspace within 15 minutes of the latest flagged contact.'}</Txt></>}<Txt size={10} color={t.muted} style={{ marginTop: 6 }}>Timing proximity cannot show that access data was sent. Actual ad placement, targeting reason, words, and payload remain unavailable.</Txt></View>
            <Button label="Review permission and ad controls" small variant="secondary" icon="sliders" onPress={() => { chooseControl(accesses[0]?.sensor ?? 'Cross-app tracking', app.id); toast(mode === 'device' ? `${app.name} selected in the controls below.` : 'Review the controls below, then choose the real app in your phone settings.'); }}/>
            <Button label={`Show ${app.name} in full timeline`} small variant="ghost" icon="clock" onPress={() => { setOnlyAppId(app.id); setSensorFocus(null); setFilter('All records'); setLimit(30); toast(`${app.name} selected in the timeline below. Use Show more to review older records.`); }}/>
          </View>}
        </View>;
      })}
      {!journeys.length && <EmptyState title="No app journeys yet" description={mode === 'device' ? 'Import an Apple App Privacy Report to see app access and domain contacts.' : 'Try a wider time range to see sample app journeys.'} icon="activity" action={mode === 'device' ? 'Import report' : undefined} onAction={mode === 'device' ? () => navigate('Settings') : undefined}/>}
      {journeys.length > 4 && <View style={{ alignSelf: 'flex-start', marginTop: 10 }}><Button label={showAllApps ? 'Show fewer apps' : `Show all ${journeys.length} apps`} variant="ghost" small onPress={() => setShowAllApps(value => !value)}/></View>}
    </Card>

    <Card>
      <SectionHeading title="Ads you noticed" subtitle="Add your own observation of an ad and where it appeared" />
      <InfoNote>IPward cannot automatically read ad impressions or exact spoken and typed words from other apps. Anything entered here is your own note, stored locally and never labeled as detected activity.</InfoNote>
      <TextInput accessibilityLabel="App where you saw the ad" placeholder="App where the ad appeared" placeholderTextColor={t.subtle} value={adAppName} onChangeText={value => { setAdAppName(value); setAdError(''); }} maxLength={80} style={{ minHeight: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: t.border, borderRadius: 11, backgroundColor: t.background, color: t.text, marginTop: 8 }}/>
      <TextInput accessibilityLabel="Ad wording or topic you noticed" placeholder="Words or topic you noticed in the ad" placeholderTextColor={t.subtle} value={adWording} onChangeText={value => { setAdWording(value); setAdError(''); }} maxLength={280} multiline style={{ minHeight: 78, paddingHorizontal: 13, paddingVertical: 12, borderWidth: 1, borderColor: t.border, borderRadius: 11, backgroundColor: t.background, color: t.text, marginTop: 10, textAlignVertical: 'top' }}/>
      <Txt size={12} weight="600" style={{ marginTop: 16 }}>Where you remember the topic coming from</Txt>
      <Txt size={10} color={t.muted} style={{ marginTop: 3 }}>Your recollection only. This does not mean the app captured it.</Txt>
      <View style={{ ...styles.wrap, marginTop: 9, gap: 7 }}><Pill label="Unsure" active={adOrigin === 'unsure'} onPress={() => setAdOrigin('unsure')}/><Pill label="Said aloud" active={adOrigin === 'spoken'} onPress={() => setAdOrigin('spoken')}/><Pill label="Typed in browser" active={adOrigin === 'browser-typing'} onPress={() => setAdOrigin('browser-typing')}/><Pill label="Other" active={adOrigin === 'other'} onPress={() => setAdOrigin('other')}/></View>
      <TextInput accessibilityLabel="Up to ten recalled words or topics" placeholder="Optional: up to 10 words or topics, separated by commas" placeholderTextColor={t.subtle} value={adTopics} onChangeText={value => { setAdTopics(value); setAdError(''); }} maxLength={430} multiline style={{ minHeight: 68, paddingHorizontal: 13, paddingVertical: 12, borderWidth: 1, borderColor: t.border, borderRadius: 11, backgroundColor: t.background, color: t.text, marginTop: 12, textAlignVertical: 'top' }}/>
      {adError && <Txt accessibilityRole="alert" size={11} color={t.red} style={{ marginTop: 8 }}>{adError}</Txt>}
      <View style={{ alignSelf: 'flex-start', marginTop: 13 }}><Button label="Log ad seen now" icon="plus" onPress={logSighting}/></View>
      <View style={{ marginTop: 19 }}><SectionHeading title="Your ad notes" subtitle={`${adSightings.length} self-reported · separate from device evidence`}/>{adSightings.slice(0, showAllSightings ? adSightings.length : 5).map(item => <View key={item.id} style={{ borderTopWidth: 1, borderColor: t.border, paddingVertical: 13 }}><Txt size={13} weight="700">{item.appName}</Txt><Txt size={10} color={t.muted}>{when(item.observedAt)} · Entered by you{item.recalledOrigin && item.recalledOrigin !== 'unsure' ? ` · Recalled source: ${item.recalledOrigin === 'spoken' ? 'said aloud' : item.recalledOrigin === 'browser-typing' ? 'typed in browser' : 'other'}` : ''}</Txt><Txt size={12} style={{ marginTop: 5 }}>{item.wording}</Txt>{!!item.topics?.length && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>{item.topics.map((topic, index) => <View key={`${item.id}-${index}`} style={{ borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: t.elevated }}><Txt size={10} color={t.purple}>{topic}</Txt></View>)}</View>}<View style={{ alignSelf: 'flex-start', marginTop: 8 }}>{confirmRemove === item.id ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button label="Confirm remove" small variant="danger" onPress={() => { removeAdSighting(item.id); setConfirmRemove(null); }}/><Button label="Cancel" small variant="ghost" onPress={() => setConfirmRemove(null)}/></View> : <Button label="Remove note" small variant="ghost" onPress={() => setConfirmRemove(item.id)}/>}</View></View>)}{!adSightings.length && <Txt size={12} color={t.muted}>No ads logged. You can record an ad you saw without implying IPward detected it.</Txt>}{adSightings.length > 5 && <View style={{ alignSelf: 'flex-start', marginTop: 8 }}><Button label={showAllSightings ? 'Show fewer notes' : `Show all ${adSightings.length} notes`} small variant="ghost" onPress={() => setShowAllSightings(value => !value)}/></View>}</View>
    </Card>

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
          <Txt size={11} color={t.muted}>{mode === 'device' ? 'Provider label' : 'Example organization'}: {owner?.name ?? 'Unknown'} · {mode === 'device' ? `${event.reportFirstAt ? `First in report: ${when(event.reportFirstAt)} · ` : ''}Latest: ${when(event.timestamp)}` : when(event.timestamp)}</Txt>
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
            ? `${item.event.reportFirstAt ? `First in report ${when(item.event.reportFirstAt)} · ` : ''}Latest contact ${when(item.event.timestamp)} · ${item.event.reportHits ?? 1} contacts in report window`
            : `${when(item.event.timestamp)} · sample event`;
        return <View key={`${item.kind}-${item.event.id}`} style={{ borderTopWidth: 1, borderColor: t.border, paddingVertical: 15, gap: 5 }}>
          <Txt size={13} weight="600">{app?.name ?? 'Unattributed app'} · {isAccess ? `${detail} access` : `Contacted ${detail}`}</Txt>
          <Txt size={11} color={t.muted}>{secondary}</Txt>
          <Txt size={11} color={isAccess ? t.cyan : t.blue}>{isAccess ? `Input modality: ${item.event.sensor}. ${resourceMeaning(item.event.sensor)}` : 'Source modality: app network contact. The originating input, including any typed or spoken content, is unknown.'}</Txt>
          {!isAccess && <Txt size={11} color={t.muted}>{mode === 'device' ? 'Provider label' : 'Example organization'}: {ownerById.get(item.event.organizationId ?? '')?.name ?? 'Unknown'} · Contents sent: unknown</Txt>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 }}><Badge state={item.event.provenance.state}/>{!isAccess && <Button small label="Details" variant="ghost" onPress={() => openDetail({ type: 'connection', id: item.event.id })}/ >}{isAccess && <Button small label="Select controls ↑" variant="ghost" onPress={() => { chooseControl(item.event.sensor, item.event.appId); toast('Selected this data type. Scroll up to review its phone controls.'); }}/>}</View>
        </View>;
      })}
      {!visible.length && <EmptyState title="No matching records" description={mode === 'device' ? 'Import an Apple App Privacy Report, choose a wider time range, or change the filters.' : 'Change the time range or filters to explore the sample.'} icon="clock" action={mode === 'device' ? 'Import report' : undefined} onAction={mode === 'device' ? () => navigate('Settings') : undefined} />}
      {visible.length > limit && <Button label={`Show more · ${visible.length - limit} remaining`} variant="secondary" onPress={() => setLimit(value => value + 30)} />}
    </Card>


  </View>;
}
