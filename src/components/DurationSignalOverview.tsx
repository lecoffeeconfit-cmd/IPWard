import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { isMarketingCategory } from '../services/classifier';
import { useTheme } from '../theme';
import { DataMode, PrivacyDataset } from '../types';
import { Badge, Card, Icon, InfoNote, Txt, styles } from './ui';
import { SignalTrendChart, SignalTrendSeries } from './SignalTrendChart';

interface PeriodConfig {
  id: string;
  title: string;
  detail: string;
  start: number;
  end: number;
  bins: number;
  axis: [string, string, string];
}

function bucketCounts<T extends { timestamp: number }>(items: readonly T[], start: number, end: number, bins: number, include: (item: T) => boolean) {
  const values = Array.from({ length: bins }, () => 0);
  const span = Math.max(1, end - start);
  items.forEach(item => {
    if (item.timestamp < start || item.timestamp > end || !include(item)) return;
    const index = Math.min(bins - 1, Math.max(0, Math.floor((item.timestamp - start) / span * bins)));
    values[index] += 1;
  });
  return values;
}

function dayStart(timestamp: number, daysBack = 0) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysBack);
  return date.getTime();
}

function shortDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function hour(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric' });
}

function buildPeriods(now: number): PeriodConfig[] {
  const today = dayStart(now);
  const yesterday = dayStart(now, 1);
  const sevenDays = dayStart(now, 6);
  const thirtyDays = dayStart(now, 29);
  const midpoint = (start: number, end: number) => start + (end - start) / 2;
  return [
    { id: 'live', title: 'LIVE', detail: 'Last 60 minutes · 5-minute buckets', start: now - 60 * 60 * 1000, end: now, bins: 12, axis: ['60m ago', '30m ago', 'Now'] },
    { id: 'today', title: 'TODAY', detail: 'Since midnight · adaptive hourly buckets', start: today, end: now, bins: 12, axis: [hour(today), hour(midpoint(today, now)), 'Now'] },
    { id: 'yesterday', title: 'YESTERDAY', detail: 'Full day · 2-hour buckets', start: yesterday, end: today - 1, bins: 12, axis: ['12 AM', '12 PM', '11 PM'] },
    { id: 'week', title: '7 DAYS', detail: 'Daily signal counts', start: sevenDays, end: now, bins: 7, axis: [shortDate(sevenDays), shortDate(midpoint(sevenDays, now)), 'Today'] },
    { id: 'month', title: '30 DAYS', detail: 'Three-day signal groups', start: thirtyDays, end: now, bins: 10, axis: [shortDate(thirtyDays), shortDate(midpoint(thirtyDays, now)), 'Today'] },
  ];
}

function LegendItem({ label, color }: { label: string; color: string }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, minHeight: 30, borderRadius: 15, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, shadowColor: color, shadowOpacity: .55, shadowRadius: 5 }}/><Txt size={10} color={t.muted} weight="600">{label}</Txt></View>;
}

function SignalTotal({ item }: { item: SignalTrendSeries }) {
  const t = useTheme();
  const total = item.values.reduce((sum, value) => sum + value, 0);
  return <View accessibilityLabel={`${item.label}: ${total}`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.color }}/><Txt size={12} color={item.color} weight="700" style={{ fontVariant: ['tabular-nums'] }}>{total}</Txt><Txt size={9} color={t.subtle}>{item.label}</Txt></View>;
}

export function DurationSignalOverview({ dataset, mode }: { dataset: PrivacyDataset; mode: DataMode }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const mobile = width < 600;
  const [now] = React.useState(() => Date.now());
  const periods = buildPeriods(now);
  const imported = mode === 'device';
  const labels = {
    connections: imported ? 'Domain records' : 'Connections',
    marketing: imported ? 'Cross-app flags' : 'Marketing signals',
    microphone: 'Microphone access',
    camera: 'Camera access',
  };
  const palette = { connections: t.blue, marketing: t.amber, microphone: t.purple, camera: t.cyan };

  return <Card style={{ padding: 0, backgroundColor: t.light ? '#EEF3F1' : '#151E24', borderColor: t.light ? '#BCC9C7' : '#46545D' }}>
    <View style={{ paddingHorizontal: mobile ? 17 : 24, paddingTop: 22, paddingBottom: 24 }}>
      <View style={{ ...styles.between, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><Icon name="bar-chart-2" size={17} color={t.blue}/><Txt size={10} color={t.blue} weight="700" style={{ letterSpacing: 1.55 }}>MULTI-RANGE / SIGNAL MATRIX</Txt></View>
          <Txt size={mobile ? 22 : 27} weight="600" style={{ marginTop: 9, letterSpacing: -.65 }}>Every time window, one signal language.</Txt>
          <Txt size={12} color={t.muted} style={{ marginTop: 5, maxWidth: 700 }}>Compare recorded network and sensor activity across five durations. Colors stay consistent from one timeline to the next.</Txt>
        </View>
        <Badge state={imported ? 'Confirmed' : 'Observed'}/>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 18, marginBottom: 15 }}>
        <LegendItem label={labels.connections} color={palette.connections}/>
        <LegendItem label={labels.marketing} color={palette.marketing}/>
        <LegendItem label={labels.microphone} color={palette.microphone}/>
        <LegendItem label={labels.camera} color={palette.camera}/>
      </View>
      <View style={{ height: 1, backgroundColor: t.border, marginBottom: 13 }}/>
      <View style={{ gap: 12 }}>
        {periods.map((period, index) => {
          const series: SignalTrendSeries[] = [
            { id: 'connections', label: labels.connections, color: palette.connections, values: bucketCounts(dataset.connections, period.start, period.end, period.bins, () => true) },
            { id: 'marketing', label: labels.marketing, color: palette.marketing, values: bucketCounts(dataset.connections, period.start, period.end, period.bins, event => imported ? !!event.potentialTracker : isMarketingCategory(event.category)) },
            { id: 'microphone', label: labels.microphone, color: palette.microphone, values: bucketCounts(dataset.sensors, period.start, period.end, period.bins, event => event.sensor === 'Microphone') },
            { id: 'camera', label: labels.camera, color: palette.camera, values: bucketCounts(dataset.sensors, period.start, period.end, period.bins, event => event.sensor === 'Camera') },
          ];
          return <View key={period.id} style={{ padding: mobile ? 13 : 16, borderRadius: 16, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 2, backgroundColor: index === 0 ? t.blue : t.border }}/>
            <View style={{ flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Txt size={9} color={index === 0 ? t.blue : t.subtle} weight="700" style={{ letterSpacing: 1.3 }}>{String(index + 1).padStart(2, '0')}</Txt><View><Txt size={12} weight="700" style={{ letterSpacing: .9 }}>{period.title}</Txt><Txt size={9} color={t.subtle} style={{ marginTop: 2 }}>{period.detail}</Txt></View></View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: mobile ? 10 : 14 }}>{series.map(item => <SignalTotal key={item.id} item={item}/>)}</View>
            </View>
            <View style={{ marginTop: 11 }}><SignalTrendChart series={series} height={mobile ? 112 : 132}/></View>
            <View style={{ ...styles.between, marginTop: 5 }}>{period.axis.map((label, axisIndex) => <Txt key={`${label}-${axisIndex}`} size={8} color={axisIndex === 2 ? t.blue : t.subtle}>{label}</Txt>)}</View>
          </View>;
        })}
      </View>
      <InfoNote icon="info">Each panel uses one shared count scale for all four lines, so taller traces mean more recorded events in that window. Marketing labels describe endpoint categories or imported cross-app flags; sensor access does not prove recording or transmission.</InfoNote>
    </View>
  </Card>;
}

/** A compact overview of the same five windows, intended for a narrow dashboard column. */
export function CompactDurationSignalOverview({ dataset, mode }: { dataset: PrivacyDataset; mode: DataMode }) {
  const t = useTheme();
  const [now] = React.useState(() => Date.now());
  const periods = buildPeriods(now);
  const imported = mode === 'device';
  const labels = {
    connections: imported ? 'Domain records' : 'Connections',
    marketing: imported ? 'Cross-app flags' : 'Marketing signals',
    microphone: 'Microphone access',
    camera: 'Camera access',
  };
  const palette = { connections: t.blue, marketing: t.amber, microphone: t.purple, camera: t.cyan };

  return <View accessibilityLabel="Compact signal charts for live, today, yesterday, seven-day and thirty-day windows" style={{ gap: 6 }}>
    {periods.map((period, index) => {
      const series: SignalTrendSeries[] = [
        { id: 'connections', label: labels.connections, color: palette.connections, values: bucketCounts(dataset.connections, period.start, period.end, period.bins, () => true) },
        { id: 'marketing', label: labels.marketing, color: palette.marketing, values: bucketCounts(dataset.connections, period.start, period.end, period.bins, event => imported ? !!event.potentialTracker : isMarketingCategory(event.category)) },
        { id: 'microphone', label: labels.microphone, color: palette.microphone, values: bucketCounts(dataset.sensors, period.start, period.end, period.bins, event => event.sensor === 'Microphone') },
        { id: 'camera', label: labels.camera, color: palette.camera, values: bucketCounts(dataset.sensors, period.start, period.end, period.bins, event => event.sensor === 'Camera') },
      ];
      const total = series.reduce((sum, item) => sum + item.values.reduce((inner, value) => inner + value, 0), 0);
      return <View key={period.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 31 }}>
        <View style={{ width: 61 }}><Txt size={8} color={index === 0 ? t.blue : t.subtle} weight="700" style={{ letterSpacing: .75 }}>{period.title}</Txt><Txt size={7} color={t.subtle} numberOfLines={1} style={{ marginTop: 1 }}>{period.detail.split(' · ')[0]}</Txt></View>
        <View style={{ flex: 1 }}><SignalTrendChart series={series} height={30} compact/></View>
        <Txt size={8} color={t.muted} style={{ width: 30, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{total}</Txt>
      </View>;
    })}
  </View>;
}

export default DurationSignalOverview;
