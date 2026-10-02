import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { Card, Txt, Icon, SectionHeading, Pill, InfoNote, EmptyState, styles } from '../components/ui';
import { DestinationMap } from '../components/DestinationMap';
import { filterConnections, summarizeConnections, formatSummaryBytes } from '../services/analytics';

export function DestinationsScreen() {
  const { dataset, range, mode, openDetail, settings, navigate } = useApp();
  const t = useTheme();
  const [view, setView] = useState<'Organizations' | 'Countries'>('Organizations');
  const events = filterConnections(dataset, { range });
  const geographyAvailable = events.some(event => !!event.countryCode);
  const groups = view === 'Organizations'
    ? dataset.organizations.map(org => ({ id: org.id, name: org.name, color: org.color, events: events.filter(event => event.organizationId === org.id) }))
    : [...new Set(events.filter(event => event.countryCode).map(event => event.country))].map(country => ({ id: country, name: country, color: t.blue, events: events.filter(event => event.country === country) }));
  return <View style={styles.stack}>
    <Card><SectionHeading title="A connected world" subtitle={geographyAvailable ? 'Where observed network endpoints are located' : 'What the source can tell us about destinations'}/>
      {mode === 'demo' && <DestinationMap height={230} light={settings.light} onCountryPress={country => openDetail({ type: 'country', id: country })}/>}
      <InfoNote>{geographyAvailable ? 'Endpoint geography does not establish where personal information is stored.' : 'The imported Apple report does not contain endpoint locations. Domain owner labels come from that report and are not independently verified.'}</InfoNote>
    </Card>
    <View style={styles.row}><Pill label="Organizations" active={view === 'Organizations'} onPress={() => setView('Organizations')}/><Pill label="Countries" active={view === 'Countries'} onPress={() => setView('Countries')}/></View>
    <Card>{groups.filter(group => group.events.length > 0).sort((a, b) => b.events.length - a.events.length).map(group => {
      const summary = summarizeConnections(group.events);
      return <Pressable accessibilityRole="button" key={group.id} onPress={() => openDetail({ type: view === 'Organizations' ? 'organization' : 'country', id: group.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderBottomWidth: 1, borderColor: t.border }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: group.color + '20', alignItems: 'center', justifyContent: 'center' }}><Icon name={view === 'Countries' ? 'map-pin' : 'globe'} color={group.color} size={17}/></View>
        <View style={{ flex: 1 }}><Txt size={14} weight="500">{group.name}</Txt><Txt size={11} color={t.muted}>{summary.apps} apps · {summary.connections} {mode === 'device' ? 'domain records' : 'connections'}</Txt></View>
        <Txt size={13}>↑ {formatSummaryBytes(summary, 'up')}</Txt><Icon name="chevron-right" size={15}/>
      </Pressable>;
    })}
    {!events.length && <EmptyState title="No destinations yet" description="Import an Apple report in Settings or choose a wider time range." icon="globe" action="Open settings" onAction={() => navigate('Settings')}/>}
    {!!events.length && !groups.some(group => group.events.length) && <EmptyState title="Location unavailable" description="This source does not provide endpoint country information." icon="map-pin"/>}
    </Card>
  </View>;
}
