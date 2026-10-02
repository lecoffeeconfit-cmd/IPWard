import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DataMode } from '../types';
import { formatSummaryBytes, summarizeConnections } from '../services/analytics';
import { useTheme } from '../theme';
import { Badge, Button, Card, Icon, Txt } from './ui';
import { InstrumentDial } from './InstrumentDial';
import { TrafficChart } from './TrafficChart';

interface OverviewInstrumentProps {
  mode: DataMode;
  summary: ReturnType<typeof summarizeConnections>;
  traffic: number[];
  reducedMotion: boolean;
  paused: boolean;
  onConnections: () => void;
  onCapture: () => void;
  onEvidence: () => void;
}

export function OverviewInstrument({ mode, summary, traffic, reducedMotion, paused, onConnections, onCapture, onEvidence }: OverviewInstrumentProps) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const mobile = width < 600;
  const measured = (summary.measuredTransfers ?? 0) > 0;
  const imported = mode === 'device';
  const caption = imported ? 'IMPORTED APPLE REPORT' : paused ? 'SAMPLE FEED PAUSED' : 'SAMPLE ACTIVITY';
  return <Card style={{ padding: 0, backgroundColor: t.light ? '#ECF1EE' : '#172027', borderColor: t.light ? '#BBC7C7' : '#47555D' }}>
    <LinearGradient colors={t.light ? ['#FFFFFF99', '#DCE6E200', '#C6D4D01A'] : ['#5C6A6830', '#17202700', '#FF792912']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ pointerEvents: 'none', position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}/>
    <View style={{ paddingHorizontal: mobile ? 19 : 28, paddingTop: 21, paddingBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: imported ? t.cyan : t.blue, shadowColor: imported ? t.cyan : t.blue, shadowOpacity: 0.8, shadowRadius: 8 }}/><Txt size={10} color={t.muted} weight="700" style={{ letterSpacing: 1.65 }}>IPWARD / SIGNAL DECK</Txt></View>
        <Badge state={imported ? 'Confirmed' : 'Observed'} onPress={onEvidence}/>
      </View>
      <View style={{ height: 1, backgroundColor: t.border, marginTop: 18, marginBottom: 17 }}/>
      <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: wide ? 20 : 8 }}>
        <View style={{ flex: wide ? 1 : undefined, alignItems: 'center' }}>
          <Txt size={10} color={t.blue} weight="700" style={{ letterSpacing: 1.8, alignSelf: 'flex-start', marginBottom: 6 }}>{caption}</Txt>
          <InstrumentDial value={summary.connections.toLocaleString()} label={imported ? 'domain records' : 'connections'} size={mobile ? 204 : 236} active={!paused} reducedMotion={reducedMotion} onPress={onConnections}/>
          <Txt size={11} color={t.muted} style={{ marginTop: 4, textAlign: 'center' }}>{summary.apps} {summary.apps === 1 ? 'app' : 'apps'} · {summary.organizations} {imported ? 'reported owners' : 'organizations'}</Txt>
        </View>
        <View style={{ flex: wide ? 1.25 : undefined, paddingTop: wide ? 12 : 8 }}>
          <View style={{ flexDirection: 'row', gap: 18, marginBottom: 25 }}>
            <View style={{ flex: 1, borderLeftWidth: 2, borderLeftColor: t.blue, paddingLeft: 12 }}><Txt size={10} color={t.muted} weight="600" style={{ letterSpacing: 0.8 }}>TRANSFER OUT</Txt><Txt size={measured ? 25 : 17} color={measured ? t.blue : t.muted} weight="500" style={{ marginTop: 5, fontVariant: ['tabular-nums'] }}>{measured ? formatSummaryBytes(summary, 'up') : 'Unavailable'}</Txt></View>
            <View style={{ flex: 1, borderLeftWidth: 2, borderLeftColor: t.cyan, paddingLeft: 12 }}><Txt size={10} color={t.muted} weight="600" style={{ letterSpacing: 0.8 }}>TRANSFER IN</Txt><Txt size={measured ? 25 : 17} color={measured ? t.cyan : t.muted} weight="500" style={{ marginTop: 5, fontVariant: ['tabular-nums'] }}>{measured ? formatSummaryBytes(summary, 'down') : 'Unavailable'}</Txt></View>
          </View>
          <View style={{ borderTopWidth: 1, borderColor: t.border, paddingTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}><Txt size={10} color={t.muted} weight="700" style={{ letterSpacing: 1.45 }}>{measured ? 'OUTBOUND TRACE / 24H' : 'TRANSFER TRACE'}</Txt><Icon name="activity" size={14} color={measured ? t.blue : t.subtle}/></View>
            {measured ? <TrafficChart values={traffic} height={mobile ? 118 : 142} color={t.blue} light={t.light} reducedMotion={reducedMotion}/> : <View style={{ height: mobile ? 118 : 142, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.border, borderRadius: 10, borderStyle: 'dashed' }}><Txt size={12} color={t.muted} style={{ textAlign: 'center', maxWidth: 245 }}>Apple reports domain contacts, but does not include transfer volume.</Txt></View>}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>{['00', '06', '12', '18', '24'].map(hour => <Txt key={hour} size={9} color={t.subtle}>{hour}</Txt>)}</View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 24 }}><Button label={imported ? 'Explore records' : 'Explore connections'} icon="arrow-up-right" onPress={onConnections}/><Button label={imported ? 'Save snapshot' : 'Start capture'} icon="aperture" variant="secondary" onPress={onCapture}/></View>
        </View>
      </View>
    </View>
  </Card>;
}
