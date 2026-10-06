import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { AdSighting, AppProfile, ConnectionEvent, DataMode, SensorEvent } from '../types';
import { resourceMeaning, summarizeModalities } from '../services/modalityInsights';
import { useTheme } from '../theme';
import { Badge, Button, Card, Icon, IconName, Pill, SectionHeading, Txt } from './ui';

const when = (value: number) => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function OriginTile({ icon, label, value, detail, color }: { icon: IconName; label: string; value: string; detail: string; color: string }) {
  const t = useTheme();
  return <View style={{ flexGrow: 1, flexBasis: 145, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.elevated, gap: 5 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Icon name={icon} size={15} color={color}/><Txt size={11} weight="700" style={{ flex: 1 }}>{label}</Txt></View>
    <Txt size={22} weight="700" color={color}>{value}</Txt>
    <Txt size={10} color={t.muted}>{detail}</Txt>
  </View>;
}

export function ModalityExplorer({ apps, sensors, connections, adSightings, mode, onOpenConnection }: { apps: readonly AppProfile[]; sensors: readonly SensorEvent[]; connections: readonly ConnectionEvent[]; adSightings: readonly AdSighting[]; mode: DataMode; onOpenConnection: (id: string) => void }) {
  const t = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const availableApps = useMemo(() => {
    const ids = new Set([...sensors.map(event => event.appId), ...connections.map(event => event.appId)]);
    return apps.filter(app => ids.has(app.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [apps, sensors, connections]);
  const selected = availableApps.find(app => app.id === selectedId)
    ?? availableApps.find(app => /instagram/i.test(`${app.name} ${app.identifier}`))
    ?? availableApps[0];
  const matches = availableApps.filter(app => `${app.name} ${app.identifier}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 20);
  const summary = useMemo(() => selected ? summarizeModalities(selected.id, sensors, connections) : null, [selected, sensors, connections]);
  const recalledTopics = useMemo(() => selected ? adSightings
    .filter(note => note.appName.trim().toLowerCase() === selected.name.toLowerCase())
    .flatMap(note => (note.topics ?? []).map(topic => ({ topic, origin: note.recalledOrigin ?? 'unsure', noteId: note.id })))
    .slice(0, 10) : [], [adSightings, selected]);
  const sourceLabel = mode === 'device' ? 'Apple report' : 'Fictional sample';

  return <Card>
    <SectionHeading title="Where the signal came from" subtitle="Choose an app to inspect input paths and the latest 10 records"/>
    <Txt size={11} color={t.muted}>An access interval identifies a resource an app used. A domain row identifies a network destination. These records do not link the resource to the destination.</Txt>
    {!!availableApps.length && <>
      {availableApps.length > 12 && <TextInput accessibilityLabel="Find app for signal origins" placeholder="Find an app" placeholderTextColor={t.subtle} value={query} onChangeText={setQuery} style={{ minHeight: 44, marginTop: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: t.border, borderRadius: 10, color: t.text, backgroundColor: t.background }}/ >}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 15 }}>
        {matches.map(app => <Pill key={app.id} label={app.name} active={selected?.id === app.id} onPress={() => setSelectedId(app.id)}/>)}
      </ScrollView>
    </>}
    {!selected || !summary ? <Txt size={12} color={t.muted} style={{ marginTop: 12 }}>No app access or domain records are available for this time range.</Txt> : <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        <OriginTile icon="mic" label="Microphone" value={String(summary.microphoneAccesses)} detail="Access intervals · no audio or words" color={t.cyan}/>
        <OriginTile icon="grid" label="Other resources" value={String(summary.otherAccesses.reduce((sum, item) => sum + item.count, 0))} detail={summary.otherAccesses.length ? summary.otherAccesses.map(item => `${item.sensor} ${item.count}`).join(' · ') : 'No other access intervals'} color={t.purple}/>
        <OriginTile icon="type" label="Browser typing" value="—" detail="Searches and typed text unavailable" color={t.muted}/>
        <OriginTile icon="globe" label="Network" value={String(summary.domainContacts)} detail="Domain records · payload unavailable" color={t.blue}/>
      </View>
      <View style={{ marginTop: 13, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.amberTint, flexDirection: 'row', gap: 11, alignItems: 'flex-start' }}>
        <Icon name="message-circle" size={18} color={t.amber}/>
        <View style={{ flex: 1 }}><Txt size={13} weight="700">0 device-verified words or topics</Txt><Txt size={11} color={t.muted} style={{ marginTop: 4 }}>IPward has no transcript, browser text, or readable payload from {selected.name}. No spoken word can be tied to a domain contact or marketing use from these records.</Txt></View>
      </View>
      {!!recalledTopics.length && <View style={{ marginTop: 13, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: t.border }}>
        <Txt size={12} weight="700">Your recalled topics for ads in {selected.name}</Txt>
        <Txt size={10} color={t.muted} style={{ marginTop: 3 }}>Entered by you · up to 10 shown · not detected microphone or browser content</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 }}>{recalledTopics.map((item, index) => <View key={`${item.noteId}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: t.elevated }}><Icon name={item.origin === 'spoken' ? 'volume-2' : item.origin === 'browser-typing' ? 'type' : 'edit-3'} size={12} color={t.purple}/><Txt size={10} color={t.text}>{item.topic}</Txt><Txt size={9} color={t.muted}>· {item.origin === 'spoken' ? 'said' : item.origin === 'browser-typing' ? 'typed' : 'recalled'}</Txt></View>)}</View>
      </View>}
      <View style={{ marginTop: 19 }}><SectionHeading title="10 recent source clues" subtitle={`${Math.min(10, summary.recent.length)} shown · ${sourceLabel} · events, not captured words`}/>
        {summary.recent.map((item, index) => {
          const access = item.kind === 'access';
          const title = access ? `${item.event.sensor} access` : `Contacted ${item.event.domain}`;
          const detail = access ? resourceMeaning(item.event.sensor) : 'Input source and data sent are unknown. This domain contact does not establish ad use.';
          return <View key={`${item.kind}-${item.event.id}`} style={{ flexDirection: 'row', gap: 11, borderTopWidth: 1, borderColor: t.border, paddingVertical: 12 }}>
            <View style={{ width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: access ? t.cyanTint : t.blueTint }}><Txt size={10} weight="700" color={access ? t.cyan : t.blue}>{String(index + 1).padStart(2, '0')}</Txt></View>
            <View style={{ flex: 1, gap: 3 }}><Txt size={12} weight="700">{title}</Txt><Txt size={10} color={t.muted}>{when(item.event.timestamp)} · {sourceLabel}</Txt><Txt size={11} color={t.muted}>{detail}</Txt>{!access && <View style={{ alignSelf: 'flex-start', marginTop: 3 }}><Button label="Domain details" small variant="ghost" onPress={() => onOpenConnection(item.event.id)}/></View>}</View>
            <View style={{ alignSelf: 'flex-start' }}><Badge state={item.event.provenance.state}/></View>
          </View>;
        })}
        {!summary.recent.length && <Txt size={11} color={t.muted}>No clues for this app in the selected period.</Txt>}
      </View>
    </>}
  </Card>;
}
