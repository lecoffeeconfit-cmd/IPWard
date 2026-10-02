import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Button, Card, EmptyState, Icon, IconName, InfoNote, Metric, Pill, SectionHeading, styles, Txt } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { filterByRange } from '../services/analytics';
import { SensorType } from '../types';

const sensorIcons: Record<SensorType, IconName> = { Microphone: 'mic', Camera: 'camera', Location: 'map-pin', Photos: 'image', Contacts: 'users', Bluetooth: 'bluetooth', Calendar: 'calendar' };
const categories: SensorType[] = ['Microphone', 'Camera', 'Location', 'Photos', 'Contacts', 'Bluetooth', 'Calendar'];

export function SensorsScreen() {
  const t = useTheme();
  const { dataset, range, mode, openDetail, navigate } = useApp();
  const [category, setCategory] = useState<SensorType | 'All'>('All');
  const [limit, setLimit] = useState(20);
  const events = useMemo(() => filterByRange(dataset.sensors, range, dataset.generatedAt), [dataset, range]);
  const filtered = events.filter(event => category === 'All' || event.sensor === category);
  if (mode === 'device' && !events.length) return <EmptyState title="No sensor intervals available" description="Import an Apple App Privacy Report in Settings to see recorded access intervals. IPward does not continuously monitor other apps' sensors." icon="aperture" action="Import a report" onAction={() => navigate('Settings')} />;
  return <View style={styles.stack}>
    <View style={styles.wrap}>{(['Microphone', 'Camera', 'Location'] as SensorType[]).map(sensor => <Metric key={sensor} label={sensor} value={events.filter(event => event.sensor === sensor).length} unit="accesses" icon={sensorIcons[sensor]} state={mode === 'device' ? 'Confirmed' : 'Observed'} detail={`${new Set(events.filter(event => event.sensor === sensor).map(event => event.appId)).size} apps · ${mode === 'device' ? 'Imported intervals' : 'Sample events'}`} onPress={() => { setCategory(sensor); setLimit(20); }} />)}</View>
    <Card style={{ backgroundColor: t.cyanTint, borderColor: t.cyanTint }}><View style={{ ...styles.row, alignItems: 'flex-start' }}><Icon name="eye" color={t.cyan} size={22} /><View style={{ flex: 1 }}><Txt size={15} weight="600">Access is a signal. Content is private.</Txt><Txt size={12} color={t.muted} style={{ marginTop: 6 }}>An access event identifies a sensitive resource in use. It does not reveal a recording, what was captured, or where that content went.</Txt></View></View></Card>
    <View style={styles.wrap}><Pill label="All sensors" active={category === 'All'} onPress={() => { setCategory('All'); setLimit(20); }} />{categories.map(sensor => <Pill key={sensor} label={sensor} icon={sensorIcons[sensor]} active={category === sensor} onPress={() => { setCategory(sensor); setLimit(20); }} />)}</View>
    <Card>
      <SectionHeading title={category === 'All' ? 'Sensor access timeline' : `${category} access`} subtitle={`${filtered.length} ${mode === 'device' ? 'imported intervals' : 'sample access events'} · ${range}`} />
      {filtered.slice(0, limit).map(event => {
        const app = dataset.apps.find(item => item.id === event.appId);
        const seconds = Math.max(1, Math.round((event.timestampEnd - event.timestamp) / 1000));
        return <Pressable key={event.id} accessibilityRole="button" onPress={() => event.appId ? openDetail({ type: 'app', id: event.appId }) : navigate('Trust')} style={({ pressed }) => ({ flexDirection: 'row', gap: 14, paddingVertical: 17, borderTopColor: t.border, borderTopWidth: 1, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.cyanTint, alignItems: 'center', justifyContent: 'center' }}><Icon name={sensorIcons[event.sensor]} color={t.cyan} size={18} /></View>
          <View style={{ flex: 1, gap: 4 }}><Txt size={14} weight="500">{app?.name ?? 'Unattributed app'}</Txt><Txt size={12} color={t.muted}>{event.sensor} · {seconds}s · {event.foregroundState === 'background' ? 'Background' : event.foregroundState === 'foreground' ? 'While in use' : 'App state unknown'}</Txt><Badge state={event.provenance.state} /></View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}><Txt size={11} color={t.muted}>{new Date(event.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Txt>{range !== 'Today' && range !== 'Live' && <Txt size={10} color={t.subtle}>{new Date(event.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Txt>}<Icon name="chevron-right" size={14} /></View>
        </Pressable>;
      })}
      {!filtered.length && <View style={{ paddingVertical: 35, alignItems: 'center', gap: 10 }}><Icon name={category === 'All' ? 'aperture' : sensorIcons[category]} size={28} /><Txt size={15}>{mode === 'device' ? 'No imported intervals in this period' : 'No sample events in this period'}</Txt><Txt color={t.muted} size={12}>Try another sensor or a wider time range.</Txt></View>}
      {filtered.length > limit && <Button variant="secondary" label="Show more access events" onPress={() => setLimit(value => value + 20)} />}
    </Card>
    <InfoNote>{mode === 'device' ? 'These intervals come from a user-imported Apple report. Access does not reveal what was recorded or where content went. IPward is not continuously monitoring sensors.' : 'Permission and access are different. An app may have permission without using a sensor. The sample history shows access events; real device access requires a supported operating-system source.'}</InfoNote>
  </View>;
}
