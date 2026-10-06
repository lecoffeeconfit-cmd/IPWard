import React from 'react';
import { View } from 'react-native';
import { ConnectionEvent } from '../types';
import { getDestinationInsight } from '../services/destinationInsight';
import { useTheme } from '../theme';
import { Badge, Card, Icon, SectionHeading, Txt } from './ui';

export function DestinationInsightCard({ event, compact = false }: { event: ConnectionEvent; compact?: boolean }) {
  const t = useTheme();
  const insight = getDestinationInsight(event);
  return <Card style={{ marginTop: compact ? 15 : 18, padding: compact ? 16 : 20 }}>
    <SectionHeading title="Where this contact may lead" subtitle="Endpoint location · likely service role"/>
    <View style={{ padding: 15, borderRadius: 14, backgroundColor: t.blueTint, borderWidth: 1, borderColor: t.blue + '55' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Icon name="map-pin" size={15} color={t.blue}/><Txt size={10} color={t.blue} weight="700" style={{ letterSpacing: 0.8 }}>ENDPOINT REGION</Txt></View>
        <Badge state={insight.locationState}/>
      </View>
      <Txt size={19} weight="600" style={{ marginTop: 9 }}>{insight.location}</Txt>
      <Txt size={11} color={t.muted} style={{ marginTop: 5 }}>{insight.locationExplanation}</Txt>
    </View>
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 11, flexWrap: 'wrap' }}>
      <View style={{ flexGrow: 1, flexBasis: 165, padding: 13, borderRadius: 12, backgroundColor: t.elevated }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Icon name="server" size={13} color={t.cyan}/><Txt size={10} color={t.muted} weight="700" style={{ letterSpacing: 0.6 }}>LIKELY ROLE</Txt></View>
        <Txt size={13} weight="600" style={{ marginTop: 7 }}>{insight.role}</Txt>
        <View style={{ marginTop: 7 }}><Badge state={insight.roleState}/></View>
      </View>
      <View style={{ flexGrow: 1, flexBasis: 165, padding: 13, borderRadius: 12, backgroundColor: t.elevated }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Icon name="activity" size={13} color={t.purple}/><Txt size={10} color={t.muted} weight="700" style={{ letterSpacing: 0.6 }}>POSSIBLE PURPOSE</Txt></View>
        <Txt size={13} weight="600" style={{ marginTop: 7 }}>{insight.purpose}</Txt>
        <Txt size={10} color={t.subtle} style={{ marginTop: 7 }}>Based on the domain category, not this transfer’s contents.</Txt>
      </View>
    </View>
    {insight.locationState !== 'Unavailable' && <Txt size={11} color={t.muted} style={{ marginTop: 13 }}><Txt weight="600" size={11}>Why that region? </Txt>{insight.regionReason}</Txt>}
    <View style={{ borderTopWidth: 1, borderColor: t.border, paddingTop: 12, marginTop: 13 }}>
      <Txt size={11} weight="600">Data center and headquarters</Txt>
      <Txt size={11} color={t.muted} style={{ marginTop: 4 }}>{insight.facility} A company headquarters is not evidence that traffic went there. The final storage or processing location is unavailable.</Txt>
    </View>
  </Card>;
}
