import React, { useState } from 'react';
import { View } from 'react-native';
import { ConnectionEvent } from '../types';
import { useTheme } from '../theme';
import { Badge, Button, Card, Icon, SectionHeading, Txt, styles } from './ui';
import { formatEventBytes, formatTime } from '../services/analytics';
import { DataUseEvidence } from './DataUseEvidence';
import { DestinationInsightCard } from './DestinationInsightCard';

function DetailFact({ label, value, valueColor }: { label: string; value: string | number; valueColor?: string }) {
  const t = useTheme();
  return <View style={{ ...styles.between, minHeight: 39, paddingVertical: 8, borderBottomWidth: 1, borderColor: t.border }}>
    <Txt size={11} color={t.muted} style={{ flex: 1 }}>{label}</Txt>
    <Txt size={11} color={valueColor ?? t.text} weight="600" style={{ maxWidth: '66%', textAlign: 'right' }}>{value}</Txt>
  </View>;
}

function displayState(event: ConnectionEvent) {
  if (event.foregroundState === 'foreground') return 'App in use';
  if (event.foregroundState === 'background') return 'App in background';
  return 'App state unknown';
}

export function ConnectionDetails({ event, appName, organizationName, onOpenFull }: { event: ConnectionEvent; appName: string; organizationName: string; onOpenFull?: () => void }) {
  const t = useTheme();
  const [technical, setTechnical] = useState(false);
  const categories = event.classification.categories.length ? event.classification.categories.join(' · ') : event.category;
  const contactLabel = event.reportHits === undefined ? 'One observed event' : `${event.reportHits.toLocaleString()} reported contacts`;

  return <Card style={{ marginTop: 10, padding: 17, backgroundColor: t.elevated, borderColor: t.blue + '66' }}>
    <View style={{ ...styles.between, alignItems: 'flex-start', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Txt size={10} color={t.blue} weight="700" style={{ letterSpacing: 1.1 }}>OUTBOUND EVENT</Txt>
        <Txt size={14} weight="600" style={{ marginTop: 5 }}>{appName} → {event.domain}</Txt>
        <Txt size={11} color={t.muted} style={{ marginTop: 3 }}>{organizationName} · {formatTime(event.timestamp)}</Txt>
      </View>
      <Badge state={event.provenance.state}/>
    </View>

    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15, flexWrap: 'wrap' }}>
      <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, backgroundColor: t.blueTint, borderWidth: 1, borderColor: t.blue + '44' }}><Txt size={10} color={t.blue} weight="700">{event.category}</Txt></View>
      <Txt size={11} color={t.subtle}>•</Txt>
      <Txt size={11} color={t.muted}>{categories}</Txt>
      {event.isNewDestination && <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: t.amberTint }}><Txt size={10} color={t.amber} weight="700">NEW DESTINATION</Txt></View>}
    </View>

    <View style={{ marginTop: 12 }}>
      <DetailFact label="What was recorded" value={`${contactLabel} to this domain`} />
      <DetailFact label="When" value={new Date(event.timestamp).toLocaleString()} />
      {event.reportFirstAt && <DetailFact label="First contact in report" value={new Date(event.reportFirstAt).toLocaleString()} />}
      <DetailFact label="App state" value={displayState(event)} valueColor={event.foregroundState === 'background' ? t.amber : undefined} />
      <DetailFact label="Outgoing traffic" value={formatEventBytes(event, 'up')} />
      <DetailFact label="Incoming traffic" value={formatEventBytes(event, 'down')} />
      <DetailFact label="Confidence" value={`${event.provenance.state} · ${event.classification.confidence} confidence`} />
    </View>

    <DestinationInsightCard event={event} compact/>

    <View style={{ marginTop: 13, padding: 12, borderRadius: 11, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }}>
      <View style={styles.row}><Icon name="compass" size={14} color={t.cyan}/><Txt size={11} weight="700">Why this label appears</Txt></View>
      <Txt size={11} color={t.muted} style={{ marginTop: 7 }}>{event.classification.explanation}</Txt>
      <Txt size={10} color={t.subtle} style={{ marginTop: 7 }}>{event.provenance.explanation}</Txt>
    </View>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 }}>
      <Button small label={technical ? 'Hide technical' : 'Show technical'} icon={technical ? 'chevron-up' : 'code'} variant="secondary" onPress={() => setTechnical(value => !value)}/>
      {onOpenFull && <Button small label="Open full record" icon="arrow-up-right" variant="ghost" onPress={onOpenFull}/>} 
    </View>

    {technical && <View style={{ marginTop: 11, padding: 12, borderRadius: 11, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }}>
      <SectionHeading title="Technical fields" subtitle="Available metadata only"/>
      <DetailFact label="IP address" value={event.ip || 'Unavailable'} />
      <DetailFact label="Protocol / port" value={`${event.protocol} · ${event.port || 'Unavailable'}`} />
      <DetailFact label="ASN" value={event.asn || 'Unavailable'} />
      <DetailFact label="Record source" value={event.source} />
      <DetailFact label="Event ID" value={event.id} />
    </View>}

    <DataUseEvidence event={event} appName={appName}/>
  </Card>;
}
