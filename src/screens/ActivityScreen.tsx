import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Badge, Button, Card, EmptyState, Icon, IconName, InfoNote, Metric, Pill, SectionHeading, styles, Txt } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { filterByRange, formatDuration, getRangeInterval } from '../services/analytics';

type ActivityKind = 'All activity' | 'Network' | 'Sensors' | 'Communication';
const filters: ActivityKind[] = ['All activity', 'Network', 'Sensors', 'Communication'];
const time = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function ActivityScreen() {
  const t = useTheme();
  const { dataset, mode, range, openDetail, navigate } = useApp();
  const [filter, setFilter] = useState<ActivityKind>('All activity');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(30);
  const connections = useMemo(() => filterByRange(dataset.connections, range, dataset.generatedAt), [dataset, range]);
  const sensors = useMemo(() => filterByRange(dataset.sensors, range, dataset.generatedAt), [dataset, range]);
  const communications = useMemo(() => filterByRange(dataset.communications, range, dataset.generatedAt), [dataset, range]);
  const interval = getRangeInterval(range, dataset.generatedAt);
  const usage = range === 'Live' ? [] : (dataset.appUsage ?? []).filter(record => record.dayStart >= interval.start && record.dayStart <= interval.end);
  const usageByApp = [...new Set(usage.map(record => record.appId))].map(appId => ({ app: dataset.apps.find(app => app.id === appId), seconds: usage.filter(record => record.appId === appId).reduce((sum, record) => sum + record.durationSeconds, 0) })).filter(row => row.app).sort((a, b) => b.seconds - a.seconds);
  const totalUsageSeconds = usage.reduce((sum, record) => sum + record.durationSeconds, 0);
  const events = useMemo(() => {
    const appName = (id: string | null) => dataset.apps.find(app => app.id === id)?.name ?? 'Unattributed app';
    return [
      ...connections.map(event => ({ id: event.id, timestamp: event.timestamp, kind: 'Network' as ActivityKind, icon: 'globe' as IconName, color: t.blue, title: `${appName(event.appId)} contacted ${event.domain}`, description: event.source === 'user-import' ? `${event.reportHits ?? 1} contacts in Apple report · latest contact shown` : `${event.category} · ${event.foregroundState === 'background' ? 'In the background' : event.foregroundState === 'foreground' ? 'While in use' : 'App state unknown'}`, state: event.provenance.state, action: () => openDetail({ type: 'connection', id: event.id }) })),
      ...sensors.map(event => ({ id: event.id, timestamp: event.timestamp, kind: 'Sensors' as ActivityKind, icon: (event.sensor === 'Microphone' ? 'mic' : event.sensor === 'Camera' ? 'camera' : event.sensor === 'Location' ? 'map-pin' : 'aperture') as IconName, color: t.cyan, title: `${appName(event.appId)} accessed ${event.sensor.toLowerCase()}`, description: `${Math.max(1, Math.round((event.timestampEnd - event.timestamp) / 1000))} seconds · ${event.foregroundState}`, state: event.provenance.state, action: () => event.appId ? openDetail({ type: 'app', id: event.appId }) : navigate('Sensors') })),
      ...communications.map(event => ({ id: event.id, timestamp: event.timestamp, kind: 'Communication' as ActivityKind, icon: (event.type === 'call' ? 'phone' : event.type === 'email' ? 'mail' : 'message-circle') as IconName, color: t.purple, title: `${appName(event.appId)} · ${event.type === 'app-usage' ? 'App activity recorded' : event.type === 'notification' ? 'Notification activity' : event.type === 'email' ? `${event.count} ${event.direction === 'incoming' ? 'received' : 'sent'} emails` : 'Call activity'}`, description: event.type === 'app-usage' || event.type === 'call' ? `${Math.floor(event.durationSeconds / 60)}m ${event.durationSeconds % 60}s · Sample record` : 'Sample metadata · Content unavailable', state: event.provenance.state, action: () => navigate('Communication') })),
    ].sort((a, b) => b.timestamp - a.timestamp);
  }, [connections, sensors, communications, dataset.apps, navigate, openDetail, t]);
  const visible = events.filter(event => (filter === 'All activity' || event.kind === filter) && `${event.title} ${event.description}`.toLowerCase().includes(query.toLowerCase()));
  const histogram = Array.from({ length: 24 }, (_, hour) => events.filter(event => new Date(event.timestamp).getHours() === hour).length);
  const highest = Math.max(1, ...histogram);

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
    <View style={styles.wrap}>{filters.map(item => <Pill key={item} label={item} active={filter === item} onPress={() => { setFilter(item); setLimit(30); }} />)}</View>
    <View style={{ ...styles.row, minHeight: 48, paddingHorizontal: 16, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, borderRadius: 11 }}>
      <Icon name="search" size={17} />
      <TextInput accessibilityLabel="Search activity history" placeholder="Search apps, domains, or activity…" placeholderTextColor={t.subtle} value={query} onChangeText={value => { setQuery(value); setLimit(30); }} style={{ flex: 1, minHeight: 46, fontSize: 13, color: t.text }} />
      {!!query && <Button label="Clear" small variant="ghost" onPress={() => setQuery('')} />}
    </View>
    {events.length > 0 && <Card style={{ paddingVertical: 6 }}>
      <View style={{ ...styles.between, paddingVertical: 15 }}><Txt size={16} weight="600">Activity history</Txt><Txt size={12} color={t.muted}>{visible.length.toLocaleString()} events</Txt></View>
      {visible.slice(0, limit).map((event, index) => <Pressable accessibilityRole="button" key={event.id} onPress={event.action} style={({ pressed }) => ({ paddingVertical: 16, flexDirection: 'row', gap: 13, alignItems: 'flex-start', borderTopWidth: 1, borderColor: t.border, opacity: pressed ? 0.65 : 1 })}>
        <View style={{ width: 35, height: 35, backgroundColor: t.elevated, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}><Icon name={event.icon} size={16} color={event.color} /></View>
        <View style={{ flex: 1, gap: 3 }}><Txt size={13} weight="500">{event.title}</Txt><Txt size={11} color={t.muted}>{event.description}</Txt><Badge state={event.state} /></View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}><Txt size={10} color={t.muted}>{time(event.timestamp)}</Txt>{range !== 'Today' && range !== 'Live' && <Txt size={10} color={t.subtle}>{new Date(event.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Txt>}<Icon name="chevron-right" size={13} /></View>
      </Pressable>)}
      {visible.length === 0 && <View style={{ paddingVertical: 30 }}><Txt color={t.muted} style={{ textAlign: 'center' }}>No activity matches your filters.</Txt></View>}
      {visible.length > limit && <View style={{ paddingVertical: 14 }}><Button label={`Show more · ${visible.length - limit} remaining`} variant="secondary" onPress={() => setLimit(value => value + 30)} /></View>}
    </Card>}
    <InfoNote>{mode === 'device' ? 'This history comes from a user-imported Apple report. Each domain row summarizes contacts; its timestamp is only the latest contact. Importing a report is not live monitoring.' : 'These are sample events. Nearby events show timing, not proof that one caused another. Encrypted message and network contents are unavailable.'}</InfoNote>
  </View>;
}
