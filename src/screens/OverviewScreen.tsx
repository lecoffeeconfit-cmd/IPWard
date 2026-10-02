import React from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { Badge, Button, Card, EmptyState, Icon, InfoNote, Metric, SectionHeading, Txt, styles } from '../components/ui';
import { OverviewInstrument } from '../components/OverviewInstrument';
import { DestinationMap } from '../components/DestinationMap';
import { ConnectionRow } from '../components/ConnectionRow';
import { filterConnections, formatDuration, getRangeInterval, summarizeConnections } from '../services/analytics';

export function OverviewScreen() {
  const { dataset, mode, range, navigate, openDetail, settings, demoPaused } = useApp();
  const t = useTheme();
  const { width } = useWindowDimensions();
  const wide = width > 1050;
  const events = filterConnections(dataset, { range });
  const summary = summarizeConnections(events);
  const traffic = Array.from({ length: 24 }, (_, hour) => events.filter(event => new Date(event.timestamp).getHours() === hour).reduce((sum, event) => sum + (event.bytesMeasured === false ? 0 : event.bytesUploaded), 0));
  const interval = getRangeInterval(range, dataset.generatedAt);
  const usage = range === 'Live' ? [] : (dataset.appUsage ?? []).filter(row => row.dayStart >= interval.start && row.dayStart <= interval.end);
  const sensorEvents = dataset.sensors.filter(event => event.timestamp >= interval.start && event.timestamp <= interval.end);
  const imported = mode === 'device';

  if (!events.length) return <View style={styles.stack}>
    <EmptyState title={imported ? 'No network records in this range' : 'No activity in this view'} description={imported ? 'Import an Apple App Privacy Report in Settings, or choose a wider time range. Live network monitoring is not connected.' : 'Choose another time range, or reload the sample workspace in Settings.'} icon="radio" action={imported ? 'Import a report' : 'View capabilities'} onAction={() => navigate(imported ? 'Settings' : 'Trust')}/>
    {imported && (usage.length > 0 || sensorEvents.length > 0) && <Card><SectionHeading title="Other activity available" subtitle="Confirmed from an authorized source"/><View style={styles.wrap}>{usage.length > 0 && <Metric label="Android app time" value={formatDuration(usage.reduce((sum, row) => sum + row.durationSeconds, 0))} icon="clock" state="Confirmed" onPress={() => navigate('Activity')}/>}<Metric label="Sensor intervals" value={sensorEvents.length} icon="aperture" state={sensorEvents.length ? 'Confirmed' : 'Unavailable'} onPress={() => navigate('Sensors')}/></View><Button label="View activity" variant="secondary" onPress={() => navigate('Activity')}/></Card>}
    <Card><SectionHeading title="Visibility, with clear boundaries"/><Txt color={t.muted}>Every measurement shows its source and level of certainty. Imported reports are historical snapshots.</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 }}><Button label="Review data & ads" onPress={() => navigate('Marketing')} variant="secondary"/><Button label="Trust & transparency" onPress={() => navigate('Trust')} variant="ghost"/></View></Card>
  </View>;

  return <View style={{ gap: 20 }}>
    <OverviewInstrument mode={mode} summary={summary} traffic={traffic} reducedMotion={settings.reducedMotion} paused={demoPaused} onConnections={() => navigate('Connections')} onCapture={() => navigate('Captures')} onEvidence={() => openDetail({ type: 'evidence', id: imported ? 'Confirmed' : 'Observed' })}/>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <Metric label={imported ? 'Domain records' : 'External connections'} value={summary.connections} icon="git-branch" state={imported ? 'Confirmed' : 'Observed'} onPress={() => navigate('Connections')}/>
      <Metric label={imported ? 'Reported owners' : 'Organizations'} value={summary.organizations} icon="globe" state={imported ? 'Confirmed' : 'Observed'} onPress={() => navigate('Destinations')}/>
      <Metric label="Background events" value={imported ? 'Unavailable' : summary.background} icon="layers" state={imported ? 'Unavailable' : 'Observed'} onPress={() => navigate('Activity')}/>
      <Metric label="New destinations" value={imported ? 'Unavailable' : summary.newDestinations} icon="navigation" state={imported ? 'Unavailable' : 'Observed'} onPress={() => navigate('Alerts')}/>
    </View>
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'stretch' }}>
      <Card style={{ flex: 1.1, minHeight: 265, backgroundColor: t.light ? '#F2F0EA' : '#211E1D' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}><View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: t.amber, alignItems: 'center', justifyContent: 'center', backgroundColor: t.amberTint }}><Icon name="eye" color={t.amber} size={18}/></View><Badge state={imported ? 'Confirmed' : 'Observed'}/></View>
        <Txt size={35} weight="500" color={t.amber} style={{ marginTop: 16, letterSpacing: -1.6, fontVariant: ['tabular-nums'] }}>{imported ? events.filter(event => event.potentialTracker).length : summary.marketing}</Txt>
        <Txt size={20} weight="500" style={{ letterSpacing: -0.4 }}>{imported ? 'potential cross-app flags' : 'marketing-related connections'}</Txt>
        <Txt size={12} color={t.muted} style={{ marginTop: 9, maxWidth: 460 }}>{imported ? 'Apple marks these domains as potentially collecting information across apps or sites. This does not prove what a contact contained.' : 'These sample destinations are associated with advertising, analytics, or attribution.'}</Txt>
        <View style={{ flex: 1, minHeight: 18 }}/><Button label="Inspect signals" icon="arrow-up-right" variant="secondary" onPress={() => navigate('Marketing')}/>
      </Card>
      <Card style={{ flex: 1 }}><SectionHeading title="Sensors & access" subtitle={imported ? 'Intervals in your imported report' : 'Sample access timeline'} action="View all" onAction={() => navigate('Sensors')}/>{(['Microphone', 'Camera', 'Location'] as const).map((sensor, index) => {
        const count = sensorEvents.filter(event => event.sensor === sensor).length;
        return <Pressable key={sensor} accessibilityRole="button" onPress={() => navigate('Sensors')} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 61, borderBottomWidth: index < 2 ? 1 : 0, borderColor: t.border }}><View style={{ width: 35, height: 35, borderRadius: 18, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' }}><Icon name={sensor === 'Microphone' ? 'mic' : sensor === 'Camera' ? 'camera' : 'map-pin'} size={16} color={sensor === 'Location' ? t.cyan : t.blue}/></View><View style={{ flex: 1 }}><Txt size={13} weight="600">{sensor}</Txt><Txt size={10} color={t.subtle}>{imported ? 'Imported intervals' : 'Sample accesses'}</Txt></View><Txt size={22} color={count ? t.text : t.subtle} style={{ fontVariant: ['tabular-nums'] }}>{count}</Txt></Pressable>;
      })}<InfoNote>Access does not establish what was captured or sent.</InfoNote></Card>
    </View>
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'stretch' }}>
      <Card style={{ flex: 1.5 }}><SectionHeading title={imported ? 'Recent domain records' : 'Recent connections'} subtitle={imported ? 'Historical contacts from your Apple report' : 'The services in the sample feed'} action="Explore" onAction={() => navigate('Connections')}/>{events.slice(0, 5).map(event => <ConnectionRow key={event.id} event={event} compact/>)}<View style={{ marginTop: 13 }}><Button label="Open connection feed" icon="arrow-right" variant="ghost" onPress={() => navigate('Live Monitor')}/></View></Card>
      <Card style={{ flex: 1 }}><SectionHeading title="Across the map" subtitle={imported ? 'Endpoint geography unavailable' : 'Illustrative destinations'} action="Explore" onAction={() => navigate('Destinations')}/>{imported ? <InfoNote>Apple App Privacy Reports do not include server location. IPward will not guess a country from a domain name.</InfoNote> : <DestinationMap height={178} light={settings.light} onCountryPress={country => openDetail({ type: 'country', id: country })}/>}<Txt size={11} color={t.muted} style={{ marginTop: 16 }}>An endpoint location does not establish where personal data is stored.</Txt><View style={{ height: 1, backgroundColor: t.border, marginVertical: 17 }}/><View style={styles.row}><Icon name="hard-drive" size={15} color={t.cyan}/><Txt size={11} color={t.muted}>Your activity stays on this device.</Txt></View></Card>
    </View>
  </View>;
}
