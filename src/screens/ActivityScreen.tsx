import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Badge, Button, Card, EmptyState, Icon, IconName, InfoNote, Metric, Pill, SectionHeading, styles, Txt } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { filterByRange, formatDuration, getRangeInterval } from '../services/analytics';
import { ConnectionDetails } from '../components/ConnectionDetails';
import { CommunicationEvent, ConnectionEvent, SensorEvent } from '../types';

type ActivityKind = 'All activity' | 'Network' | 'Sensors' | 'Communication';
const filters: ActivityKind[] = ['All activity', 'Network', 'Sensors', 'Communication'];
const time = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const categoryPurpose: Record<string, string> = { 'App service': 'Core app feature or API', CDN: 'Content delivery', Authentication: 'Sign-in or token service', Cloud: 'Sync or storage', Analytics: 'Usage or performance measurement', Advertising: 'Ad delivery or measurement', Attribution: 'Install or campaign attribution', Marketing: 'Engagement tooling', Telemetry: 'App diagnostics', 'Crash reporting': 'Error reporting', Communication: 'Messaging or call infrastructure', Unknown: 'Purpose unavailable' };
type TimelineEvent = { id: string; timestamp: number; kind: ActivityKind; icon: IconName; color: string; title: string; description: string; state: string; action: () => void; connection?: ConnectionEvent; sensor?: SensorEvent; communication?: CommunicationEvent };

function ActivityEventDetails({ event, appName, organizationName, onOpenFull }: { event: TimelineEvent; appName: string; organizationName: string; onOpenFull: () => void }) {
  const t = useTheme();
  if (event.connection) return <ConnectionDetails event={event.connection} appName={appName} organizationName={organizationName} onOpenFull={onOpenFull}/>;
  if (event.sensor) {
    const sensor = event.sensor;
    const duration = Math.max(1, Math.round((sensor.timestampEnd - sensor.timestamp) / 1000));
    return <Card style={{ marginTop: 10, padding: 17, backgroundColor: t.elevated, borderColor: t.cyan + '66' }}>
      <View style={{ ...styles.between, alignItems: 'flex-start', gap: 12 }}><View style={{ flex: 1 }}><Txt size={10} color={t.cyan} weight="700" style={{ letterSpacing: 1.1 }}>SENSOR EVENT</Txt><Txt size={14} weight="600" style={{ marginTop: 5 }}>{appName} accessed {sensor.sensor.toLowerCase()}</Txt><Txt size={11} color={t.muted} style={{ marginTop: 3 }}>{new Date(sensor.timestamp).toLocaleString()}</Txt></View><Badge state={sensor.provenance.state}/></View>
      <View style={{ marginTop: 12 }}><View style={{ ...styles.between, minHeight: 39, paddingVertical: 8, borderBottomWidth: 1, borderColor: t.border }}><Txt size={11} color={t.muted}>Access window</Txt><Txt size={11} weight="600">{formatDuration(duration)}</Txt></View><View style={{ ...styles.between, minHeight: 39, paddingVertical: 8, borderBottomWidth: 1, borderColor: t.border }}><Txt size={11} color={t.muted}>App state</Txt><Txt size={11} weight="600" color={sensor.foregroundState === 'background' ? t.amber : t.text}>{sensor.foregroundState === 'foreground' ? 'App in use' : sensor.foregroundState === 'background' ? 'App in background' : 'Unknown'}</Txt></View><View style={{ ...styles.between, minHeight: 39, paddingVertical: 8, borderBottomWidth: 1, borderColor: t.border }}><Txt size={11} color={t.muted}>Source</Txt><Txt size={11} weight="600">{sensor.source}</Txt></View></View>
      <InfoNote icon="shield">This confirms an operating-system access interval. It does not reveal what was recorded, what was said, or whether the sensor data was sent anywhere.</InfoNote><Button small label="Open app profile" icon="arrow-up-right" variant="secondary" onPress={onOpenFull}/>
    </Card>;
  }
  if (event.communication) {
    const communication = event.communication;
    const label = communication.type === 'email' ? `${communication.count} ${communication.direction === 'incoming' ? 'received' : communication.direction === 'outgoing' ? 'sent' : 'unclassified'} emails` : communication.type === 'call' ? `${communication.count} call${communication.count === 1 ? '' : 's'} · ${formatDuration(communication.durationSeconds)}` : communication.type === 'notification' ? `${communication.count} notifications` : `App activity · ${formatDuration(communication.durationSeconds)}`;
    return <Card style={{ marginTop: 10, padding: 17, backgroundColor: t.elevated, borderColor: t.purple + '66' }}><View style={{ ...styles.between, alignItems: 'flex-start', gap: 12 }}><View style={{ flex: 1 }}><Txt size={10} color={t.purple} weight="700" style={{ letterSpacing: 1.1 }}>COMMUNICATION EVENT</Txt><Txt size={14} weight="600" style={{ marginTop: 5 }}>{appName} · {communication.type}</Txt><Txt size={11} color={t.muted} style={{ marginTop: 3 }}>{new Date(communication.timestamp).toLocaleString()}</Txt></View><Badge state={communication.provenance.state}/></View><View style={{ marginTop: 12 }}><View style={{ ...styles.between, minHeight: 39, paddingVertical: 8, borderBottomWidth: 1, borderColor: t.border }}><Txt size={11} color={t.muted}>Recorded activity</Txt><Txt size={11} weight="600">{label}</Txt></View><View style={{ ...styles.between, minHeight: 39, paddingVertical: 8, borderBottomWidth: 1, borderColor: t.border }}><Txt size={11} color={t.muted}>Source</Txt><Txt size={11} weight="600">{communication.source}</Txt></View></View><InfoNote icon="shield">Only summary metadata is available. IPward cannot inspect message text, email contents, call audio, or infer the exact data exchanged.</InfoNote><Button small label="Open communication view" icon="arrow-up-right" variant="secondary" onPress={onOpenFull}/></Card>;
  }
  return null;
}

export function ActivityScreen() {
  const t = useTheme();
  const { dataset, mode, range, openDetail, navigate } = useApp();
  const [filter, setFilter] = useState<ActivityKind>('All activity');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(30);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const connections = useMemo(() => filterByRange(dataset.connections, range, dataset.generatedAt), [dataset, range]);
  const sensors = useMemo(() => filterByRange(dataset.sensors, range, dataset.generatedAt), [dataset, range]);
  const communications = useMemo(() => filterByRange(dataset.communications, range, dataset.generatedAt), [dataset, range]);
  const interval = getRangeInterval(range, dataset.generatedAt);
  const usage = range === 'Live' ? [] : (dataset.appUsage ?? []).filter(record => record.dayStart >= interval.start && record.dayStart <= interval.end);
  const usageByApp = [...new Set(usage.map(record => record.appId))].map(appId => ({ app: dataset.apps.find(app => app.id === appId), seconds: usage.filter(record => record.appId === appId).reduce((sum, record) => sum + record.durationSeconds, 0) })).filter(row => row.app).sort((a, b) => b.seconds - a.seconds);
  const totalUsageSeconds = usage.reduce((sum, record) => sum + record.durationSeconds, 0);
  const events = useMemo<TimelineEvent[]>(() => {
    const appName = (id: string | null) => dataset.apps.find(app => app.id === id)?.name ?? 'Unattributed app';
    return [
      ...connections.map(event => ({ id: event.id, timestamp: event.timestamp, kind: 'Network' as ActivityKind, icon: 'globe' as IconName, color: t.blue, title: `${appName(event.appId)} contacted ${event.domain}`, description: event.source === 'user-import' ? `${event.reportHits ?? 1} contacts in Apple report · latest contact shown` : `${event.category} · ${event.foregroundState === 'background' ? 'In the background' : event.foregroundState === 'foreground' ? 'While in use' : 'App state unknown'}`, state: event.provenance.state, action: () => openDetail({ type: 'connection', id: event.id }), connection: event })),
      ...sensors.map(event => ({ id: event.id, timestamp: event.timestamp, kind: 'Sensors' as ActivityKind, icon: (event.sensor === 'Microphone' ? 'mic' : event.sensor === 'Camera' ? 'camera' : event.sensor === 'Location' ? 'map-pin' : 'aperture') as IconName, color: t.cyan, title: `${appName(event.appId)} accessed ${event.sensor.toLowerCase()}`, description: `${Math.max(1, Math.round((event.timestampEnd - event.timestamp) / 1000))} seconds · ${event.foregroundState}`, state: event.provenance.state, action: () => event.appId ? openDetail({ type: 'app', id: event.appId }) : navigate('Sensors'), sensor: event })),
      ...communications.map(event => ({ id: event.id, timestamp: event.timestamp, kind: 'Communication' as ActivityKind, icon: (event.type === 'call' ? 'phone' : event.type === 'email' ? 'mail' : 'message-circle') as IconName, color: t.purple, title: `${appName(event.appId)} · ${event.type === 'app-usage' ? 'App activity recorded' : event.type === 'notification' ? 'Notification activity' : event.type === 'email' ? `${event.count} ${event.direction === 'incoming' ? 'received' : 'sent'} emails` : 'Call activity'}`, description: event.type === 'app-usage' || event.type === 'call' ? `${Math.floor(event.durationSeconds / 60)}m ${event.durationSeconds % 60}s · Sample record` : 'Sample metadata · Content unavailable', state: event.provenance.state, action: () => navigate('Communication'), communication: event })),
    ].sort((a, b) => b.timestamp - a.timestamp);
  }, [connections, sensors, communications, dataset.apps, navigate, openDetail, t]);
  const visible = events.filter(event => (filter === 'All activity' || event.kind === filter) && `${event.title} ${event.description}`.toLowerCase().includes(query.toLowerCase()));
  const histogram = Array.from({ length: 24 }, (_, hour) => events.filter(event => new Date(event.timestamp).getHours() === hour).length);
  const highest = Math.max(1, ...histogram);
  const networkGroups = [...new Set(connections.map(event => event.category))].map(category => ({ category, count: connections.filter(event => event.category === category).length })).sort((a, b) => b.count - a.count);
  const backgroundConnections = connections.filter(event => event.foregroundState === 'background');
  const backgroundGroups = [...new Set(backgroundConnections.map(event => event.category))].map(category => ({ category, count: backgroundConnections.filter(event => event.category === category).length })).sort((a, b) => b.count - a.count);
  const sensorGroups = [...new Set(sensors.map(event => event.sensor))].map(sensor => ({ sensor, count: sensors.filter(event => event.sensor === sensor).length, seconds: sensors.filter(event => event.sensor === sensor).reduce((sum, event) => sum + Math.max(1, Math.round((event.timestampEnd - event.timestamp) / 1000)), 0) })).sort((a, b) => b.count - a.count);

  if (mode === 'device' && !events.length && !usage.length) return <EmptyState title="Your activity timeline starts here" description="Import an Apple App Privacy Report, or on Android grant Usage Access in Settings. Live network and sensor monitoring are not connected." icon="activity" action="Open settings" onAction={() => navigate('Settings')} />;

  return <View style={styles.stack}>
    <View style={styles.wrap}>
      <Metric label={mode === 'device' ? 'Domain records' : 'Network events'} value={connections.length.toLocaleString()} icon="globe" state={mode === 'device' ? 'Confirmed' : 'Observed'} detail={mode === 'device' ? 'Imported Apple report rows' : 'Sample connection records'} />
      <Metric label="Sensor access" value={sensors.length.toLocaleString()} icon="aperture" state={mode === 'device' ? 'Confirmed' : 'Observed'} detail={mode === 'device' ? 'Imported access intervals' : 'Sample access events'} onPress={() => navigate('Sensors')} />
      <Metric label="Background events" value={mode === 'device' ? 'Unavailable' : connections.filter(event => event.foregroundState === 'background').length.toLocaleString()} icon="moon" state={mode === 'device' ? 'Unavailable' : 'Observed'} detail={mode === 'device' ? 'Apple report does not include app foreground state' : 'Network activity outside app use'} />
      {mode === 'device' && <Metric label="Android app time" value={usage.length ? formatDuration(totalUsageSeconds) : 'Unavailable'} icon="clock" state={usage.length ? 'Confirmed' : 'Unavailable'} detail="Daily OS foreground-time aggregates"/>}
    </View>
    {usage.length > 0 && <Card><SectionHeading title="Apps used on this Android device" subtitle={`${range} · OS daily foreground-time totals`}/>{usageByApp.slice(0, 15).map(({ app, seconds }) => <Pressable key={app!.id} accessibilityRole="button" onPress={() => openDetail({ type: 'app', id: app!.id })} style={{ ...styles.between, paddingVertical: 12, borderTopWidth: 1, borderColor: t.border }}><Txt size={13}>{app!.name}</Txt><Txt size={13} color={t.blue}>{formatDuration(seconds)}</Txt></Pressable>)}<InfoNote>Android supplies daily time aggregates. This does not tell IPward what happened inside an app or whether time was spent communicating.</InfoNote></Card>}
    {events.length > 0 && <Card>
      <SectionHeading title="The rhythm of your day" subtitle={`${range} · ${mode === 'device' ? 'latest contact and access times' : 'sample events'} by hour of day`} />
      <View accessible accessibilityLabel={`Histogram of ${events.length} ${mode === 'device' ? 'imported records' : 'sample events'} across the selected period.`} style={{ height: 116, flexDirection: 'row', alignItems: 'flex-end', gap: 5, paddingTop: 10 }}>
        {histogram.map((count, hour) => <View key={hour} style={{ flex: 1, height: `${Math.max(count ? 5 : 1, count / highest * 100)}%`, borderRadius: 3, backgroundColor: count ? t.blue : t.elevated, opacity: hour === new Date(dataset.generatedAt).getHours() ? 1 : 0.58 }} />)}
      </View>
      <View style={{ ...styles.between, marginTop: 12 }}><Txt size={10} color={t.muted}>12 AM</Txt><Txt size={10} color={t.muted}>6 AM</Txt><Txt size={10} color={t.muted}>12 PM</Txt><Txt size={10} color={t.muted}>6 PM</Txt><Txt size={10} color={t.muted}>11 PM</Txt></View>
    </Card>}
    {(connections.length > 0 || sensors.length > 0) && <Card>
      <SectionHeading title="Signal breakdown" subtitle="See the kind of activity first, then open an example for its evidence" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 220, padding: 14, borderRadius: 15, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border }}>
          <View style={styles.between}><View style={styles.row}><Icon name="globe" size={15} color={t.blue}/><Txt size={11} color={t.blue} weight="700" style={{ letterSpacing: .7 }}>NETWORK EVENTS</Txt></View><Badge state={mode === 'device' ? 'Estimated' : 'Observed'}/></View>
          <Txt size={11} color={t.muted} style={{ marginTop: 8, marginBottom: 5 }}>Likely purpose by endpoint classification</Txt>
          {networkGroups.slice(0, 6).map(row => { const first = connections.find(event => event.category === row.category); return <Pressable key={row.category} accessibilityRole="button" onPress={() => first ? openDetail({ type: 'connection', id: first.id }) : navigate('Connections')} style={{ ...styles.between, gap: 8, paddingVertical: 9, borderTopWidth: 1, borderColor: t.border }}><View style={{ flex: 1 }}><Txt size={12} weight="600">{row.category}</Txt><Txt size={10} color={t.subtle}>{categoryPurpose[row.category] ?? 'Purpose unavailable'}</Txt></View><Txt size={13} color={t.blue} weight="600">{row.count}</Txt><Icon name="chevron-right" size={13}/></Pressable>; })}
          {!networkGroups.length && <Txt size={11} color={t.subtle} style={{ paddingVertical: 13 }}>No network events in this range.</Txt>}
        </View>
        <View style={{ flex: 1, minWidth: 220, padding: 14, borderRadius: 15, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border }}>
          <View style={styles.between}><View style={styles.row}><Icon name="moon" size={15} color={t.amber}/><Txt size={11} color={t.amber} weight="700" style={{ letterSpacing: .7 }}>BACKGROUND EVENTS</Txt></View><Badge state={mode === 'device' ? 'Unavailable' : 'Observed'}/></View>
          <Txt size={11} color={t.muted} style={{ marginTop: 8, marginBottom: 5 }}>{mode === 'device' ? 'Apple reports do not include app foreground state' : 'Network activity outside active app use'}</Txt>
          {mode === 'device' ? <Txt size={11} color={t.subtle} style={{ paddingVertical: 13 }}>Unavailable from this source. Imported domain rows do not say whether the app was open.</Txt> : backgroundGroups.slice(0, 6).map(row => { const first = backgroundConnections.find(event => event.category === row.category); return <Pressable key={row.category} accessibilityRole="button" onPress={() => first ? openDetail({ type: 'connection', id: first.id }) : navigate('Connections')} style={{ ...styles.between, gap: 8, paddingVertical: 9, borderTopWidth: 1, borderColor: t.border }}><View style={{ flex: 1 }}><Txt size={12} weight="600">{row.category}</Txt><Txt size={10} color={t.subtle}>{categoryPurpose[row.category] ?? 'Purpose unavailable'}</Txt></View><Txt size={13} color={t.amber} weight="600">{row.count}</Txt><Icon name="chevron-right" size={13}/></Pressable>; })}
          {mode !== 'device' && !backgroundGroups.length && <Txt size={11} color={t.subtle} style={{ paddingVertical: 13 }}>No background network events in this range.</Txt>}
        </View>
        <View style={{ flex: 1, minWidth: 220, padding: 14, borderRadius: 15, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border }}>
          <View style={styles.between}><View style={styles.row}><Icon name="aperture" size={15} color={t.cyan}/><Txt size={11} color={t.cyan} weight="700" style={{ letterSpacing: .7 }}>SENSOR EVENTS</Txt></View><Badge state={mode === 'device' ? 'Confirmed' : 'Observed'}/></View>
          <Txt size={11} color={t.muted} style={{ marginTop: 8, marginBottom: 5 }}>Access intervals by sensor</Txt>
          {sensorGroups.slice(0, 6).map(row => { const first = sensors.find(event => event.sensor === row.sensor); return <Pressable key={row.sensor} accessibilityRole="button" onPress={() => first?.appId ? openDetail({ type: 'app', id: first.appId }) : navigate('Sensors')} style={{ ...styles.between, gap: 8, paddingVertical: 9, borderTopWidth: 1, borderColor: t.border }}><View style={{ flex: 1 }}><Txt size={12} weight="600">{row.sensor}</Txt><Txt size={10} color={t.subtle}>{formatDuration(row.seconds)} of recorded access</Txt></View><Txt size={13} color={t.cyan} weight="600">{row.count}</Txt><Icon name="chevron-right" size={13}/></Pressable>; })}
          {!sensorGroups.length && <Txt size={11} color={t.subtle} style={{ paddingVertical: 13 }}>No sensor events in this range.</Txt>}
        </View>
      </View>
      <InfoNote icon="compass">A network category is a likely service role, not proof of the payload or the reason a specific record was sent. Tap a row to open the underlying event or app profile.</InfoNote>
    </Card>}
    <View style={styles.wrap}>{filters.map(item => <Pill key={item} label={item} active={filter === item} onPress={() => { setFilter(item); setLimit(30); }} />)}</View>
    <View style={{ ...styles.row, minHeight: 48, paddingHorizontal: 16, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, borderRadius: 11 }}>
      <Icon name="search" size={17} />
      <TextInput accessibilityLabel="Search activity history" placeholder="Search apps, domains, or activity…" placeholderTextColor={t.subtle} value={query} onChangeText={value => { setQuery(value); setLimit(30); }} style={{ flex: 1, minHeight: 46, fontSize: 13, color: t.text }} />
      {!!query && <Button label="Clear" small variant="ghost" onPress={() => setQuery('')} />}
    </View>
    {events.length > 0 && <Card style={{ paddingVertical: 6 }}>
      <View style={{ ...styles.between, paddingVertical: 15 }}><Txt size={16} weight="600">Activity history</Txt><Txt size={12} color={t.muted}>{visible.length.toLocaleString()} events</Txt></View>
      {visible.slice(0, limit).map(event => { const expanded = expandedId === event.id; const appName = dataset.apps.find(app => app.id === (event.connection?.appId ?? event.sensor?.appId ?? event.communication?.appId))?.name ?? 'Unattributed app'; const organizationName = event.connection ? dataset.organizations.find(org => org.id === event.connection?.organizationId)?.name ?? 'Unknown provider' : 'Not applicable'; return <View key={event.id}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${event.title}. ${expanded ? 'Hide details' : 'Show details'}`} onPress={() => setExpandedId(expanded ? null : event.id)} style={({ pressed }) => ({ paddingVertical: 16, flexDirection: 'row', gap: 13, alignItems: 'flex-start', borderTopWidth: 1, borderColor: t.border, opacity: pressed ? 0.65 : 1 })}>
          <View style={{ width: 35, height: 35, backgroundColor: t.elevated, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}><Icon name={event.icon} size={16} color={event.color} /></View>
          <View style={{ flex: 1, gap: 3 }}><Txt size={13} weight="500">{event.title}</Txt><Txt size={11} color={t.muted}>{event.description}</Txt><Badge state={event.state} /></View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}><Txt size={10} color={t.muted}>{time(event.timestamp)}</Txt>{range !== 'Today' && range !== 'Live' && <Txt size={10} color={t.subtle}>{new Date(event.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Txt>}<Txt size={9} color={t.blue}>{expanded ? 'Hide details' : 'View details'}</Txt><Icon name={expanded ? 'chevron-up' : 'chevron-right'} size={13} color={expanded ? t.blue : t.muted} /></View>
        </Pressable>
        {expanded && <ActivityEventDetails event={event} appName={appName} organizationName={organizationName} onOpenFull={event.action}/>}
      </View>; })}
      {visible.length === 0 && <View style={{ paddingVertical: 30 }}><Txt color={t.muted} style={{ textAlign: 'center' }}>No activity matches your filters.</Txt></View>}
      {visible.length > limit && <View style={{ paddingVertical: 14 }}><Button label={`Show more · ${visible.length - limit} remaining`} variant="secondary" onPress={() => setLimit(value => value + 30)} /></View>}
    </Card>}
    <InfoNote>{mode === 'device' ? 'This history comes from a user-imported Apple report. Each domain row summarizes contacts; its timestamp is only the latest contact. Importing a report is not live monitoring.' : 'These are sample events. Nearby events show timing, not proof that one caused another. Encrypted message and network contents are unavailable.'}</InfoNote>
  </View>;
}
