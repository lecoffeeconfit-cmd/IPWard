import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AppProfile, ConnectionEvent, DataMode, SensorEvent } from '../types';
import { useTheme } from '../theme';
import { Badge, Card, Icon, InfoNote, SectionHeading, Txt, styles } from './ui';
import { TrafficChart } from './TrafficChart';

type MixSegment = { label: string; value: number; color: string };

function MixRing({ segments }: { segments: MixSegment[] }) {
  const t = useTheme();
  const total = Math.max(1, segments.reduce((sum, segment) => sum + segment.value, 0));
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const arcs = segments.map((segment, index) => ({ segment, length: segment.value / total * circumference, offset: segments.slice(0, index).reduce((sum, item) => sum + item.value / total * circumference, 0) }));
  return <View accessible accessibilityLabel={`Connection category chart. ${segments.map(segment => `${segment.label}: ${segment.value}`).join(', ')}`} style={{ width: 142, height: 142, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={142} height={142} viewBox="0 0 142 142">
      <Circle cx="71" cy="71" r={radius} fill="none" stroke={t.border} strokeWidth="14"/>
      {arcs.map(({ segment, length, offset }) => <Circle key={segment.label} cx="71" cy="71" r={radius} fill="none" stroke={segment.color} strokeWidth="14" strokeLinecap="butt" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform="rotate(-90 71 71)"/>)}
    </Svg>
    <View style={{ position: 'absolute', alignItems: 'center' }}><Txt size={24} weight="600">{segments.reduce((sum, segment) => sum + segment.value, 0)}</Txt><Txt size={9} color={t.muted} weight="700" style={{ letterSpacing: .65 }}>EVENTS</Txt></View>
  </View>;
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  const t = useTheme();
  return <View style={{ flex: 1, minWidth: 105, padding: 11, borderRadius: 12, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }}><Txt size={9} color={color} weight="700" style={{ letterSpacing: .65, textTransform: 'uppercase' }}>{label}</Txt><Txt size={20} weight="600" style={{ marginTop: 3 }}>{value}</Txt></View>;
}

export function OverviewAnalyticsDashboard({ events, trendEvents, sensors, apps, mode, generatedAt, reducedMotion, onOpenActivity, onOpenConnections, onOpenApp }: { events: readonly ConnectionEvent[]; trendEvents: readonly ConnectionEvent[]; sensors: readonly SensorEvent[]; apps: readonly AppProfile[]; mode: DataMode; generatedAt: number; reducedMotion: boolean; onOpenActivity: () => void; onOpenConnections: () => void; onOpenApp: (id: string) => void }) {
  const t = useTheme();
  const dayStarts = Array.from({ length: 7 }, (_, index) => { const day = new Date(generatedAt); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (6 - index)); return day.getTime(); });
  const sevenDayCounts = dayStarts.map(start => trendEvents.filter(event => event.timestamp >= start && event.timestamp < start + 86_400_000).length);
  const categories = [...new Set(events.map(event => event.category))].map(category => ({ label: category, value: events.filter(event => event.category === category).length })).sort((a, b) => b.value - a.value);
  const topCategories = categories.slice(0, 3);
  const otherCount = categories.slice(3).reduce((sum, row) => sum + row.value, 0);
  const palette = [t.blue, t.cyan, t.amber, t.purple];
  const segments = [...topCategories, ...(otherCount ? [{ label: 'Other', value: otherCount }] : [])].map((segment, index) => ({ ...segment, color: palette[index] }));
  const appRows = [...new Set(events.map(event => event.appId).filter((id): id is string => Boolean(id)))].map(appId => ({ app: apps.find(app => app.id === appId), count: events.filter(event => event.appId === appId).length, domains: new Set(events.filter(event => event.appId === appId).map(event => event.domain)).size })).filter(row => row.app).sort((a, b) => b.count - a.count);
  const maxApp = Math.max(1, ...appRows.map(row => row.count));
  const uniqueDomains = new Set(events.map(event => event.domain)).size;
  const sensorApps = new Set(sensors.map(event => event.appId).filter(Boolean)).size;

  return <Card style={{ backgroundColor: t.light ? '#F1F4F6' : '#182028' }}>
    <SectionHeading title="Privacy pulse dashboard" subtitle="Trends, category mix, and app concentration at a glance"/>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 14 }}><MiniStat label="Unique domains" value={uniqueDomains} color={t.blue}/><MiniStat label="Event categories" value={categories.length} color={t.amber}/><MiniStat label="Sensor apps" value={sensorApps} color={t.cyan}/></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <Pressable accessibilityRole="button" onPress={onOpenActivity} style={({ pressed }) => ({ flex: 1.35, minWidth: 245, padding: 15, borderRadius: 16, backgroundColor: t.elevated, borderWidth: 1, borderColor: pressed ? t.blue : t.border, opacity: pressed ? .72 : 1 })}>
        <View style={styles.between}><View><View style={styles.row}><Icon name="activity" size={15} color={t.blue}/><Txt size={11} color={t.blue} weight="700" style={{ letterSpacing: .7 }}>SEVEN-DAY TREND</Txt></View><Txt size={10} color={t.muted} style={{ marginTop: 5 }}>{mode === 'device' ? 'Imported domain records per day' : 'Sample network events per day'}</Txt></View><Badge state={mode === 'device' ? 'Confirmed' : 'Observed'}/></View>
        <View style={{ marginTop: 14 }}><TrafficChart values={sevenDayCounts} height={122} color={t.blue} light={t.light} reducedMotion={reducedMotion}/></View>
        <View style={{ ...styles.between, marginTop: 5 }}>{dayStarts.map((start, index) => <Txt key={start} size={8} color={index === dayStarts.length - 1 ? t.blue : t.subtle}>{new Date(start).toLocaleDateString([], { weekday: 'short' }).slice(0, 1)}</Txt>)}</View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onOpenConnections} style={({ pressed }) => ({ flex: 1, minWidth: 225, padding: 15, borderRadius: 16, backgroundColor: t.elevated, borderWidth: 1, borderColor: pressed ? t.amber : t.border, opacity: pressed ? .72 : 1 })}>
        <View style={styles.between}><View><View style={styles.row}><Icon name="pie-chart" size={15} color={t.amber}/><Txt size={11} color={t.amber} weight="700" style={{ letterSpacing: .7 }}>CONNECTION MIX</Txt></View><Txt size={10} color={t.muted} style={{ marginTop: 5 }}>Endpoint categories in this range</Txt></View><Badge state={mode === 'device' ? 'Estimated' : 'Observed'}/></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}><MixRing segments={segments}/><View style={{ flex: 1 }}>{segments.map(segment => <View key={segment.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: segment.color }}/><Txt size={10} color={t.muted} style={{ flex: 1 }} numberOfLines={1}>{segment.label}</Txt><Txt size={11} weight="600">{segment.value}</Txt></View>)}</View></View>
      </Pressable>
      <View style={{ flex: 1, minWidth: 225, padding: 15, borderRadius: 16, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border }}>
        <View style={styles.between}><View><View style={styles.row}><Icon name="bar-chart-2" size={15} color={t.cyan}/><Txt size={11} color={t.cyan} weight="700" style={{ letterSpacing: .7 }}>TOP APPS</Txt></View><Txt size={10} color={t.muted} style={{ marginTop: 5 }}>Share of network activity</Txt></View><Badge state={mode === 'device' ? 'Confirmed' : 'Observed'}/></View>
        <View style={{ marginTop: 9 }}>{appRows.slice(0, 5).map(row => <Pressable key={row.app!.id} accessibilityRole="button" accessibilityLabel={`${row.app!.name}, ${row.count} connections, ${row.domains} domains`} onPress={() => onOpenApp(row.app!.id)} style={({ pressed }) => ({ paddingVertical: 9, borderTopWidth: 1, borderColor: t.border, opacity: pressed ? .62 : 1 })}><View style={styles.between}><View style={{ flex: 1 }}><Txt size={11} weight="600">{row.app!.name}</Txt><Txt size={9} color={t.subtle}>{row.domains} domain{row.domains === 1 ? '' : 's'}</Txt></View><Txt size={12} color={t.cyan} weight="700">{row.count}</Txt><Icon name="chevron-right" size={12}/></View><View style={{ height: 3, borderRadius: 2, backgroundColor: t.surface, marginTop: 6, overflow: 'hidden' }}><View style={{ width: `${Math.max(4, row.count / maxApp * 100)}%`, height: 3, borderRadius: 2, backgroundColor: t.cyan }}/></View></Pressable>)}{!appRows.length && <Txt size={11} color={t.subtle} style={{ paddingVertical: 14 }}>No app network activity in this range.</Txt>}</View>
      </View>
    </View>
    <InfoNote icon="info">Tap a graph to open its detailed page. Category charts describe endpoint classifications; they do not identify encrypted contents or prove why a particular transfer occurred.</InfoNote>
  </Card>;
}
