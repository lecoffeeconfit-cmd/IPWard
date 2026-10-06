import React, { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { Badge, Button, Card, EmptyState, Icon, InfoNote, Metric, SectionHeading, Txt, styles } from '../components/ui';
import { OverviewInstrument } from '../components/OverviewInstrument';
import { DestinationMap } from '../components/DestinationMap';
import { ConnectionRow } from '../components/ConnectionRow';
import { ConnectionDetails } from '../components/ConnectionDetails';
import { OverviewAnalyticsDashboard } from '../components/OverviewAnalyticsDashboard';
import { DurationSignalOverview } from '../components/DurationSignalOverview';
import { SignalTrendSeries } from '../components/SignalTrendChart';
import { filterConnections, formatDuration, getRangeInterval, summarizeConnections } from '../services/analytics';
import { isMarketingCategory } from '../services/classifier';
import { ConnectionEvent, SensorEvent, TimeRange } from '../types';

function bucketSignals<T extends { timestamp: number }>(items: readonly T[], start: number, end: number, bins: number, include: (item: T) => boolean) {
  const values = Array.from({ length: bins }, () => 0);
  const span = Math.max(1, end - start);
  items.forEach(item => {
    if (item.timestamp < start || item.timestamp > end || !include(item)) return;
    const index = Math.min(bins - 1, Math.max(0, Math.floor((item.timestamp - start) / span * bins)));
    values[index] += 1;
  });
  return values;
}

function trendPresentation(range: TimeRange, start: number, end: number): { bins: number; axis: [string, string, string] } {
  const middle = start + (end - start) / 2;
  const time = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: 'numeric' });
  const date = (timestamp: number) => new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
  if (range === 'Live') return { bins: 12, axis: ['60m ago', '30m ago', 'Now'] };
  if (range === 'Yesterday') return { bins: 12, axis: ['12 AM', '12 PM', '11 PM'] };
  if (range === '7 days') return { bins: 7, axis: [date(start), date(middle), 'Today'] };
  if (range === '30 days') return { bins: 10, axis: [date(start), date(middle), 'Today'] };
  return { bins: 12, axis: [time(start), time(middle), 'Now'] };
}

function buildSignalSeries(events: readonly ConnectionEvent[], sensors: readonly SensorEvent[], imported: boolean, start: number, end: number, bins: number, colors: { connections: string; marketing: string; microphone: string; camera: string }): SignalTrendSeries[] {
  return [
    { id: 'connections', label: imported ? 'Domain records' : 'Connections', color: colors.connections, values: bucketSignals(events, start, end, bins, () => true) },
    { id: 'marketing', label: imported ? 'Cross-app flags' : 'Marketing', color: colors.marketing, values: bucketSignals(events, start, end, bins, event => imported ? !!event.potentialTracker : isMarketingCategory(event.category)) },
    { id: 'microphone', label: 'Microphone', color: colors.microphone, values: bucketSignals(sensors, start, end, bins, event => event.sensor === 'Microphone') },
    { id: 'camera', label: 'Camera', color: colors.camera, values: bucketSignals(sensors, start, end, bins, event => event.sensor === 'Camera') },
  ];
}

export function OverviewScreen() {
  const { dataset, mode, range, overviewTrends, navigate, openDetail, settings, demoPaused, newDomainNotices } = useApp();
  const t = useTheme();
  const { width } = useWindowDimensions();
  const wide = width > 1050;
  const events = filterConnections(dataset, { range });
  const summary = summarizeConnections(events);
  const interval = getRangeInterval(range, dataset.generatedAt);
  const firstSeenInRange = newDomainNotices.filter(item => item.firstSeenAt >= interval.start && item.firstSeenAt <= interval.end).length;
  const weekInterval = getRangeInterval('7 days', dataset.generatedAt);
  const weekEvents = filterConnections(dataset, { range: '7 days' });
  const weekSensors = dataset.sensors.filter(event => event.timestamp >= weekInterval.start && event.timestamp <= weekInterval.end);
  const weekSummary = summarizeConnections(weekEvents);
  const weekFirstSeen = newDomainNotices.filter(item => item.firstSeenAt >= weekInterval.start && item.firstSeenAt <= weekInterval.end).length;
  const weekContacts = weekEvents.reduce((sum, event) => sum + (event.reportHits ?? 1), 0);
  const usage = range === 'Live' ? [] : (dataset.appUsage ?? []).filter(row => row.dayStart >= interval.start && row.dayStart <= interval.end);
  const sensorEvents = dataset.sensors.filter(event => event.timestamp >= interval.start && event.timestamp <= interval.end);
  const imported = mode === 'device';
  const signalColors = { connections: t.blue, marketing: t.amber, microphone: t.purple, camera: t.cyan };
  const currentTrend = trendPresentation(range, interval.start, interval.end);
  const currentSignals = buildSignalSeries(events, sensorEvents, imported, interval.start, interval.end, currentTrend.bins, signalColors);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const homeViews = <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}><Txt size={10} color={t.blue} weight="700" style={{ letterSpacing: 1.2, marginRight: 5 }}>HOME / EXPLORE</Txt><Button small label="Alerts" icon="bell" variant="secondary" onPress={() => navigate('Alerts')}/><Button small label="Activity" icon="activity" variant="secondary" onPress={() => navigate('Activity')}/><Button small label="Next steps" icon="shield" variant="secondary" onPress={() => navigate('Protect')}/></View>;

  if (overviewTrends) {
    const overviewRange: TimeRange = '30 days';
    const overviewInterval = getRangeInterval(overviewRange, dataset.generatedAt);
    const overviewEvents = filterConnections(dataset, { range: overviewRange });
    const overviewSensors = dataset.sensors.filter(event => event.timestamp >= overviewInterval.start && event.timestamp <= overviewInterval.end);
    const overviewSummary = summarizeConnections(overviewEvents);
    const overviewTrend = trendPresentation(overviewRange, overviewInterval.start, overviewInterval.end);
    const overviewSignals = buildSignalSeries(overviewEvents, overviewSensors, imported, overviewInterval.start, overviewInterval.end, overviewTrend.bins, signalColors);
    return <View style={{ gap: 20 }}>
      <OverviewInstrument mode={mode} dataset={dataset} summary={overviewSummary} signals={overviewSignals} signalAxis={overviewTrend.axis} reducedMotion={settings.reducedMotion} paused={demoPaused} onConnections={() => navigate('Connections')} onCapture={() => navigate('Captures')} onEvidence={() => openDetail({ type: 'evidence', id: imported ? 'Confirmed' : 'Observed' })}/>
      {homeViews}
      <DurationSignalOverview dataset={dataset} mode={mode}/>
    </View>;
  }

  if (!events.length && !sensorEvents.length && !usage.length) return <View style={styles.stack}>
    <EmptyState title={imported ? 'No network records in this range' : 'No activity in this view'} description={imported ? 'Import an Apple App Privacy Report in Settings, or choose a wider time range. Live network monitoring is not connected.' : 'Choose another time range, or reload the sample workspace in Settings.'} icon="radio" action={imported ? 'Import a report' : 'View capabilities'} onAction={() => navigate(imported ? 'Settings' : 'Trust')}/>
    {imported && (usage.length > 0 || sensorEvents.length > 0) && <Card><SectionHeading title="Other activity available" subtitle="Confirmed from an authorized source"/><View style={styles.wrap}>{usage.length > 0 && <Metric label="Android app time" value={formatDuration(usage.reduce((sum, row) => sum + row.durationSeconds, 0))} icon="clock" state="Confirmed" onPress={() => navigate('Activity')}/>}<Metric label="Sensor intervals" value={sensorEvents.length} icon="aperture" state={sensorEvents.length ? 'Confirmed' : 'Unavailable'} onPress={() => navigate('Sensors')}/></View><Button label="View activity" variant="secondary" onPress={() => navigate('Activity')}/></Card>}
    <Card><SectionHeading title="Visibility, with clear boundaries"/><Txt color={t.muted}>Every measurement shows its source and level of certainty. Imported reports are historical snapshots.</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 }}><Button label="Review data & ads" onPress={() => navigate('Marketing')} variant="secondary"/><Button label="Trust & transparency" onPress={() => navigate('Trust')} variant="ghost"/></View></Card>
  </View>;

  return <View style={{ gap: 20 }}>
    <OverviewInstrument mode={mode} dataset={dataset} summary={summary} signals={currentSignals} signalAxis={currentTrend.axis} reducedMotion={settings.reducedMotion} paused={demoPaused} onConnections={() => navigate('Connections')} onCapture={() => navigate('Captures')} onEvidence={() => openDetail({ type: 'evidence', id: imported ? 'Confirmed' : 'Observed' })}/>
    {homeViews}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <Metric label={imported ? 'Domain records' : 'External connections'} value={summary.connections} icon="git-branch" state={imported ? 'Confirmed' : 'Observed'} onPress={() => navigate('Connections')}/>
      <Metric label={imported ? 'Provider labels' : 'Organizations'} value={summary.organizations} icon="globe" state={imported ? events.some(event => event.classification.source === 'bundled-provider-hints') ? 'Estimated' : 'Confirmed' : 'Observed'} onPress={() => navigate('Destinations')}/>
      <Metric label="Background events" value={imported ? 'Unavailable' : summary.background} icon="layers" state={imported ? 'Unavailable' : 'Observed'} onPress={() => navigate('Activity')}/>
      <Metric label={imported ? 'New to IPWard history' : 'New destinations'} value={imported ? firstSeenInRange : summary.newDestinations} icon="navigation" state="Observed" onPress={() => navigate('Alerts')}/>
    </View>
    <OverviewAnalyticsDashboard events={events} trendEvents={weekEvents} sensors={sensorEvents} apps={dataset.apps} mode={mode} generatedAt={dataset.generatedAt} reducedMotion={settings.reducedMotion} onOpenActivity={() => navigate('Activity')} onOpenConnections={() => navigate('Connections')} onOpenApp={id => openDetail({ type: 'app', id })}/>
    <Card style={{ backgroundColor: t.light ? '#F5F7F4' : '#1B2529' }}>
      <SectionHeading title="Your data journey" subtitle="A clear path from app access to network contact, with uncertainty shown" action="Open dashboard" onAction={() => navigate('Marketing')}/>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 145, padding: 13, borderRadius: 13, backgroundColor: t.elevated }}><Txt size={10} color={t.cyan} weight="700">01 / ACCESS</Txt><Txt size={20} weight="600" style={{ marginTop: 4 }}>{sensorEvents.length}</Txt><Txt size={11} color={t.muted}>{imported ? 'Imported resource intervals' : 'Sample resource accesses'}</Txt></View>
        <View style={{ flex: 1, minWidth: 145, padding: 13, borderRadius: 13, backgroundColor: t.elevated }}><Txt size={10} color={t.blue} weight="700">02 / CONTACT</Txt><Txt size={20} weight="600" style={{ marginTop: 4 }}>{events.length}</Txt><Txt size={11} color={t.muted}>{imported ? 'Historical domain rows' : 'Sample connections'}</Txt></View>
        <View style={{ flex: 1, minWidth: 145, padding: 13, borderRadius: 13, backgroundColor: t.elevated }}><Txt size={10} color={t.amber} weight="700">03 / AD SIGNAL</Txt><Txt size={20} weight="600" style={{ marginTop: 4 }}>{imported ? events.filter(event => event.potentialTracker).length : summary.marketing}</Txt><Txt size={11} color={t.muted}>{imported ? 'Potential cross-app flags' : 'Sample ad and analytics endpoints'}</Txt></View>
      </View>
      <InfoNote>IPward cannot prove that accessed data was sent to a contacted domain or explain why a specific ad appeared. Open the dashboard for each app, time, source, and available controls.</InfoNote>
    </Card>
    <Card style={{ backgroundColor: t.light ? '#F3F0F7' : '#211F2A' }}>
      <SectionHeading title="Seven-day privacy report" subtitle={imported ? 'Rolling summary of imported Apple records' : 'Illustrative sample activity'} action="Compare snapshots" onAction={() => navigate('Captures')}/>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[
          { label: 'Apps in scope', value: weekSummary.apps, color: t.cyan },
          { label: imported ? 'App–domain records' : 'Connections', value: weekEvents.length, color: t.blue },
          { label: imported ? 'Reported contacts' : 'Sample events', value: weekContacts, color: t.purple },
          { label: imported ? 'Potential cross-app flags' : 'Marketing signals', value: imported ? weekEvents.filter(event => event.potentialTracker).length : weekSummary.marketing, color: t.amber },
          { label: imported ? 'First seen in IPWard' : 'New destinations', value: imported ? weekFirstSeen : weekSummary.newDestinations, color: t.cyan },
          { label: 'Background activity', value: imported ? 'Unavailable' : weekSummary.background, color: imported ? t.subtle : t.blue },
        ].map(item => <View key={item.label} style={{ flex: 1, minWidth: 135, padding: 13, borderRadius: 13, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border }}><Txt size={10} color={item.color} weight="700" style={{ textTransform: 'uppercase', letterSpacing: .35 }}>{item.label}</Txt><Txt size={23} weight="600" style={{ marginTop: 5, fontVariant: ['tabular-nums'] }}>{item.value}</Txt></View>)}
      </View>
      <InfoNote>{imported ? `${weekSensors.length} resource-access intervals are in this report window. Apple does not provide background state, transfer volume, or exact contact times between the first and latest contact. “First seen” means first imported into IPWard, not newly added by the app.` : 'These are fictional sample records for exploring the dashboard. Compare sample captures only as an illustration.'}</InfoNote>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}><Button small label="Review notices" icon="bell" variant="secondary" onPress={() => navigate('Alerts')}/><Button small label="Save or compare reports" icon="aperture" variant="ghost" onPress={() => navigate('Captures')}/></View>
    </Card>
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
      <Card style={{ flex: 1.5 }}><SectionHeading title={imported ? 'Recent domain records' : 'Outbound events'} subtitle={imported ? 'Historical contacts from your Apple report' : 'App → provider → destination, with expandable detail'} action="Explore" onAction={() => navigate('Connections')}/>{events.slice(0, 5).map(event => { const expanded = expandedEventId === event.id; const appName = dataset.apps.find(app => app.id === event.appId)?.name ?? 'Unattributed app'; const organizationName = dataset.organizations.find(org => org.id === event.organizationId)?.name ?? 'Unknown provider'; return <View key={event.id}><ConnectionRow event={event} compact/><View style={{ alignItems: 'flex-end', paddingTop: 5 }}><Button small label={expanded ? 'Hide details' : 'Show details'} icon={expanded ? 'chevron-up' : 'chevron-down'} variant="ghost" onPress={() => setExpandedEventId(expanded ? null : event.id)}/></View>{expanded && <ConnectionDetails event={event} appName={appName} organizationName={organizationName} onOpenFull={() => openDetail({ type: 'connection', id: event.id })}/>}</View>; })}<View style={{ marginTop: 13 }}><Button label="Open outbound feed" icon="arrow-right" variant="ghost" onPress={() => navigate('Connections')}/></View></Card>
      <Card style={{ flex: 1 }}><SectionHeading title="Across the map" subtitle={imported ? 'Endpoint geography unavailable' : 'Illustrative destinations'} action="Explore" onAction={() => navigate('Destinations')}/>{imported ? <InfoNote>Apple App Privacy Reports do not include server location. IPward will not guess a country from a domain name.</InfoNote> : <DestinationMap height={178} light={settings.light} onCountryPress={country => openDetail({ type: 'country', id: country })}/>}<Txt size={11} color={t.muted} style={{ marginTop: 16 }}>An endpoint location does not establish where personal data is stored.</Txt><View style={{ height: 1, backgroundColor: t.border, marginVertical: 17 }}/><View style={styles.row}><Icon name="hard-drive" size={15} color={t.cyan}/><Txt size={11} color={t.muted}>Your activity stays on this device.</Txt></View></Card>
    </View>
  </View>;
}
