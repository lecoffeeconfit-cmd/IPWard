import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { Card, Txt, Icon, SectionHeading, Pill, InfoNote, EmptyState, styles } from '../components/ui';
import { DestinationMap } from '../components/DestinationMap';
import { filterConnections, summarizeConnections, formatSummaryBytes } from '../services/analytics';
import { ChartPanel, HorizontalBarChart } from '../components/DashboardCharts';
import { getDestinationInsight } from '../services/destinationInsight';
import { ConnectionEvent } from '../types';

function destinationSummary(events: readonly ConnectionEvent[]) {
  const locations = [...new Set(events.filter(event => event.countryCode).map(event => [event.region, event.country].filter(Boolean).join(', ')))];
  const roles = [...new Set(events.map(event => getDestinationInsight(event).role).filter(role => role !== 'Role unknown'))];
  return {
    locations: locations.length ? `${locations.slice(0, 2).join(' · ')}${locations.length > 2 ? ` +${locations.length - 2}` : ''}` : 'Endpoint region unavailable',
    roles: roles.length ? `${roles.slice(0, 2).join(' · ')}${roles.length > 2 ? ` +${roles.length - 2}` : ''}` : 'Service role unavailable',
  };
}

export function DestinationsScreen() {
  const { dataset, range, mode, openDetail, settings, navigate } = useApp();
  const t = useTheme();
  const [view, setView] = useState<'Organizations' | 'Countries'>('Organizations');
  const events = filterConnections(dataset, { range });
  const geographyAvailable = events.some(event => !!event.countryCode);
  const groups = view === 'Organizations'
    ? dataset.organizations.map(org => ({ id: org.id, name: org.name, color: org.color, events: events.filter(event => event.organizationId === org.id) }))
    : [...new Set(events.filter(event => event.countryCode).map(event => event.country))].map(country => ({ id: country, name: country, color: t.blue, events: events.filter(event => event.country === country) }));
  const rankedGroups = groups.filter(group => group.events.length > 0).sort((a, b) => b.events.length - a.events.length);
  const connectionRows = rankedGroups.slice(0, 7).map(group => ({ id: group.id, label: group.name, value: group.events.length, detail: `${summarizeConnections(group.events).apps} apps`, color: group.color }));
  const appRows = rankedGroups.slice(0, 7).map(group => ({ id: group.id, label: group.name, value: summarizeConnections(group.events).apps, detail: `${group.events.length} ${mode === 'device' ? 'records' : 'connections'}`, color: group.color }));
  const featured = events.find(event => event.countryCode && event.classification.source !== 'unknown')
    ?? events.find(event => event.classification.source !== 'unknown') ?? events[0];
  const featuredInsight = featured ? getDestinationInsight(featured) : null;
  const featuredApp = featured ? dataset.apps.find(app => app.id === featured.appId)?.name ?? 'Unattributed app' : '';
  return <View style={styles.stack}>
    {featured && featuredInsight && <Card>
      <SectionHeading title="Follow a destination" subtitle="One contact from this time range" action="Open record" onAction={() => openDetail({ type: 'connection', id: featured.id })}/>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: t.elevated }}><Txt size={10} color={t.muted} weight="700">APP</Txt><Txt size={12} weight="600">{featuredApp}</Txt></View>
        <Icon name="arrow-right" size={14} color={t.blue}/>
        <View style={{ flex: 1, minWidth: 145, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: t.blueTint }}><Txt size={10} color={t.blue} weight="700">DOMAIN CONTACTED</Txt><Txt size={12} weight="600" numberOfLines={2}>{featured.domain}</Txt></View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 13 }}>
        <View style={{ flexGrow: 1, flexBasis: 140, padding: 12, borderRadius: 11, borderWidth: 1, borderColor: t.border }}><View style={{ ...styles.row, gap: 6 }}><Icon name="map-pin" size={13} color={t.blue}/><Txt size={10} color={t.muted} weight="700">{mode === 'demo' ? 'SAMPLE REGION' : 'ENDPOINT REGION'}</Txt></View><Txt size={13} weight="600" style={{ marginTop: 6 }}>{featuredInsight.location}</Txt></View>
        <View style={{ flexGrow: 1, flexBasis: 140, padding: 12, borderRadius: 11, borderWidth: 1, borderColor: t.border }}><View style={{ ...styles.row, gap: 6 }}><Icon name="server" size={13} color={t.cyan}/><Txt size={10} color={t.muted} weight="700">LIKELY ROLE</Txt></View><Txt size={13} weight="600" style={{ marginTop: 6 }}>{featuredInsight.role}</Txt></View>
      </View>
      <View style={{ ...styles.row, alignItems: 'flex-start', marginTop: 12 }}><Icon name="compass" size={14} color={t.purple}/><Txt size={11} style={{ flex: 1 }}><Txt size={11} weight="700">Possible purpose: </Txt>{featuredInsight.purpose}</Txt></View>
      <Txt size={11} color={t.muted} style={{ marginTop: 9 }}>{featured.source === 'demo' ? 'Fictional sample. ' : ''}The role and purpose are domain-based estimates. A company’s headquarters or exact data center cannot be located from this contact.</Txt>
    </Card>}
    <Card><SectionHeading title="A connected world" subtitle={geographyAvailable ? mode === 'demo' ? 'Illustrative endpoint regions' : 'Where recorded network endpoints are located' : 'What the source can tell us about destinations'}/>
      {mode === 'demo' && <DestinationMap height={230} light={settings.light} onCountryPress={country => openDetail({ type: 'country', id: country })}/>}
      <InfoNote>{geographyAvailable ? mode === 'demo' ? 'The map illustrates selected sample destinations. Region details below come from the sample records; endpoint geography does not establish where information is stored.' : 'Endpoint geography does not establish where personal information is stored.' : 'The imported Apple report does not contain endpoint locations. Domain owner labels come from that report and are not independently verified.'}</InfoNote>
    </Card>
    <View style={styles.row}><Pill label="Organizations" active={view === 'Organizations'} onPress={() => setView('Organizations')}/><Pill label="Countries" active={view === 'Countries'} onPress={() => setView('Countries')}/></View>
    {!!rankedGroups.length && <Card><SectionHeading title="Destination graphs" subtitle={`${view} compared across the selected time range`}/><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><ChartPanel title="CONTACT VOLUME" subtitle={mode === 'device' ? 'Imported app–domain records' : 'Observed connection events'} color={t.blue}><HorizontalBarChart rows={connectionRows} color={t.blue} onPress={row => openDetail({ type: view === 'Organizations' ? 'organization' : 'country', id: row.id })}/></ChartPanel><ChartPanel title="APPS INVOLVED" subtitle={`Unique apps per ${view === 'Organizations' ? 'provider' : 'country'}`} color={t.cyan}><HorizontalBarChart rows={appRows} color={t.cyan} onPress={row => openDetail({ type: view === 'Organizations' ? 'organization' : 'country', id: row.id })}/></ChartPanel></View><InfoNote>These graphs describe endpoint contacts. A server country does not establish where personal data is stored, and a provider may operate shared infrastructure.</InfoNote></Card>}
    <Card>{rankedGroups.map(group => {
      const summary = summarizeConnections(group.events);
      const context = destinationSummary(group.events);
      return <Pressable accessibilityRole="button" key={group.id} onPress={() => openDetail({ type: view === 'Organizations' ? 'organization' : 'country', id: group.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderBottomWidth: 1, borderColor: t.border }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: group.color + '20', alignItems: 'center', justifyContent: 'center' }}><Icon name={view === 'Countries' ? 'map-pin' : 'globe'} color={group.color} size={17}/></View>
        <View style={{ flex: 1 }}><Txt size={14} weight="500">{group.name}</Txt><Txt size={11} color={t.muted}>{summary.apps} apps · {summary.connections} {mode === 'device' ? 'domain records' : 'connections'}</Txt><Txt size={10} color={t.subtle} style={{ marginTop: 4 }}>{view === 'Organizations' ? context.locations : context.roles}</Txt></View>
        <Txt size={13}>↑ {formatSummaryBytes(summary, 'up')}</Txt><Icon name="chevron-right" size={15}/>
      </Pressable>;
    })}
    {!events.length && <EmptyState title="No destinations yet" description="Import an Apple report in Settings or choose a wider time range." icon="globe" action="Open settings" onAction={() => navigate('Settings')}/>}
    {!!events.length && !groups.some(group => group.events.length) && <EmptyState title="Location unavailable" description="This source does not provide endpoint country information." icon="map-pin"/>}
    </Card>
  </View>;
}
