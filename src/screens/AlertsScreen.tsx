import React from 'react';
import { View } from 'react-native';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { Card, Txt, Icon, Button, Badge, EmptyState, InfoNote, SectionHeading, styles } from '../components/ui';
import { filterByRange, formatTime, getRangeInterval } from '../services/analytics';
import { getBehaviorInsights } from '../services/behaviorInsights';
import { ChartPanel, HorizontalBarChart, HourlyBarChart } from '../components/DashboardCharts';

export function AlertsScreen() {
  const { dataset, mode, range, openDetail, navigate, settings, newDomainNotices, dismissNewDomainNotice } = useApp();
  const t = useTheme();
  const alerts = settings.alerts ? filterByRange(dataset.alerts, range) : [];
  const behavior = getBehaviorInsights(dataset.connections, dataset.apps, mode, dataset.generatedAt);
  const interval = getRangeInterval(range, dataset.generatedAt);
  const importedNotices = settings.alerts && mode === 'device'
    ? newDomainNotices.filter(item => item.firstSeenAt >= interval.start && item.firstSeenAt <= interval.end)
    : [];
  const noticeTimes = [...alerts.map(item => item.timestamp), ...behavior.findings.map(item => item.timestamp), ...importedNotices.map(item => item.firstSeenAt)];
  const hourly = Array.from({ length: 24 }, (_, hour) => noticeTimes.filter(timestamp => new Date(timestamp).getHours() === hour).length);
  const typeRows = [
    { id: 'changes', label: 'Unusual changes', value: behavior.findings.length, detail: 'Compared with local baseline', color: t.amber },
    { id: 'activity', label: 'Activity notices', value: alerts.length, detail: 'Observed sample callouts', color: t.blue },
    { id: 'domains', label: 'First-seen domains', value: importedNotices.length, detail: 'New to IPWard history', color: t.cyan },
  ].filter(row => row.value > 0);
  const appRows = dataset.apps.map(app => ({ id: app.id, label: app.name, value: alerts.filter(item => item.appId === app.id).length + behavior.findings.filter(item => item.appName === app.name).length + importedNotices.filter(item => item.appName === app.name).length, detail: 'Notices in this view', color: app.color })).filter(row => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
  return <View style={styles.stack}>
    <Card style={{ backgroundColor: behavior.sample ? t.purpleTint : t.blueTint }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <View style={{ width: 37, height: 37, borderRadius: 12, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="activity" color={behavior.sample ? t.purple : t.blue}/></View>
        <View style={{ flex: 1 }}><Txt size={16} weight="600">Your behavior baseline</Txt><Txt size={11} color={t.muted}>Seven prior observed days · on-device comparison</Txt></View>
        {behavior.sample && <Badge state="Observed"/>}
      </View>
      <Txt size={12} color={t.muted} style={{ marginTop: 11 }}>{behavior.reason}</Txt>
      {behavior.status === 'unavailable' && mode === 'device' && <View style={{ alignSelf: 'flex-start', marginTop: 13 }}><Button small label="See data sources" icon="info" variant="secondary" onPress={() => navigate('Trust')}/></View>}
      {behavior.appBaselines.filter(item => item.observedDays >= 3).slice(0, 5).map(item => {
        const appName = dataset.apps.find(app => app.id === item.appId)?.name ?? 'App';
        return <View key={item.appId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 13, marginTop: 13, borderTopWidth: 1, borderColor: t.border }}>
          <View style={{ flex: 1 }}><Txt size={12} weight="600">{appName}</Txt><Txt size={10} color={t.muted}>Usually {item.typicalDomains.low}–{item.typicalDomains.high} domains and {item.typicalConnections.low}–{item.typicalConnections.high} connections per observed day</Txt></View>
          <Txt size={10} color={t.subtle}>{item.observedDays} days</Txt>
        </View>;
      })}
      {settings.alerts && !!behavior.findings.length && <View style={{ marginTop: 15 }}>
        <Txt size={10} color={t.amber} weight="700" style={{ letterSpacing: 1.2, marginBottom: 7 }}>UNUSUAL ACTIVITY · REVIEW, NOT A THREAT VERDICT</Txt>
        {behavior.findings.slice(0, 5).map(finding => <View key={finding.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: t.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Txt size={12} weight="600" style={{ flex: 1 }}>{finding.appName} · {finding.title}</Txt><Txt size={10} color={t.muted}>{formatTime(finding.timestamp)}</Txt></View>
          {!!finding.domain && <Txt size={11} color={t.blue} style={{ marginTop: 4 }}>{finding.domain}</Txt>}
          <Txt size={11} color={t.muted} style={{ marginTop: 4 }}>{finding.description}</Txt>
          <View style={{ alignSelf: 'flex-start', marginTop: 7 }}><Button small label="Inspect record" variant="ghost" onPress={() => openDetail({ type: 'connection', id: finding.connectionId })}/></View>
        </View>)}
      </View>}
      {settings.alerts && behavior.status === 'ready' && !behavior.findings.length && <Txt size={12} color={t.cyan} style={{ marginTop: 13 }}>No significant changes found against this local baseline.</Txt>}
      {behavior.sample && <InfoNote>The preview data is fictional. Real baselines need an event-level source. Imported Apple reports are aggregated and cannot support daily comparisons.</InfoNote>}
    </Card>
    {!!noticeTimes.length && <Card><SectionHeading title="Notice pattern graphs" subtitle="When notices appeared and which apps are represented"/><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><ChartPanel title="NOTICES BY HOUR" subtitle={`${range} · local device time`} color={t.amber}><HourlyBarChart values={hourly} color={t.amber} accessibilityLabel={`${noticeTimes.length} notices distributed by hour.`}/></ChartPanel><ChartPanel title="NOTICE TYPES" subtitle="Kinds of changes shown here" color={t.blue}><HorizontalBarChart rows={typeRows} color={t.blue}/></ChartPanel><ChartPanel title="APPS REPRESENTED" subtitle="Apps with the most notices" color={t.cyan}><HorizontalBarChart rows={appRows} color={t.cyan} onPress={row => openDetail({ type: 'app', id: row.id })}/></ChartPanel></View><InfoNote>These graphs organize notices for review. A change or unfamiliar domain is not automatically unsafe, and the sample preview is fictional.</InfoNote></Card>}
    {importedNotices.length > 0 && <>
      <View><Txt size={19} weight="600">New to your IPWard history</Txt><Txt size={12} color={t.muted} style={{ marginTop: 4 }}>First observed when you imported a report, not proof the app started using it recently.</Txt></View>
      {importedNotices.map(item => <Card key={item.id}>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <View style={{ width: 39, height: 39, borderRadius: 13, backgroundColor: t.cyanTint, alignItems: 'center', justifyContent: 'center' }}><Icon name="radio" color={t.cyan}/></View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><Badge state="Observed"/><Txt size={10} color={t.muted}>{formatTime(item.firstSeenAt)}</Txt></View>
            <Txt size={17} weight="600" style={{ marginTop: 8 }}>{item.domain}</Txt>
            <Txt size={12} color={t.muted} style={{ marginTop: 4 }}>{item.appName} → {item.organizationName ? `${item.organizationHint ? 'Likely provider hint' : 'Apple owner label'}: ${item.organizationName}` : 'Owner not identified'}</Txt>
            {item.potentialTracker && <Txt size={11} color={t.amber} style={{ marginTop: 7 }}>Apple also flagged this domain as potentially collecting information across apps or sites.</Txt>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 13 }}>
              <Button small label="Inspect domain" icon="arrow-up-right" variant="secondary" onPress={() => openDetail({ type: 'connection', id: item.id })}/>
              <Button small label="Dismiss" variant="ghost" onPress={() => dismissNewDomainNotice(item.id)}/>
            </View>
          </View>
        </View>
      </Card>)}
    </>}
    {alerts.map(alert => <Card key={alert.id}>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ width: 39, height: 39, borderRadius: 12, backgroundColor: alert.severity === 'Important' ? t.amberTint : t.blueTint, alignItems: 'center', justifyContent: 'center' }}><Icon name={alert.severity === 'Important' ? 'arrow-up-right' : 'bell'} color={alert.severity === 'Important' ? t.amber : t.blue}/></View>
        <View style={{ flex: 1 }}>
          <Txt size={11} color={t.muted}>{alert.severity} · {formatTime(alert.timestamp)}</Txt>
          <Txt size={17} weight="500" style={{ marginTop: 6 }}>{alert.title}</Txt>
          <Txt size={13} color={t.muted} style={{ marginTop: 10, marginBottom: 17 }}>{alert.description}</Txt>
          <Badge state="Observed"/>
          <View style={{ alignSelf: 'flex-start', marginTop: 10 }}><Button small label="Inspect connection" variant="secondary" onPress={() => openDetail({ type: 'connection', id: alert.connectionId })}/></View>
        </View>
      </View>
    </Card>)}
    {!alerts.length && !importedNotices.length && !(settings.alerts && behavior.findings.length) && <EmptyState title={settings.alerts ? 'Nothing to call out' : 'Activity notices are off'} description={settings.alerts ? mode === 'device' ? 'No domains were first seen in your IPWard history during this period. Unfamiliar destinations are not automatically unsafe.' : 'Sample activity changes and imported first-seen notices will appear here. Unfamiliar destinations are not automatically unsafe.' : 'You can enable notices in Protect.'} icon="bell"/>}
    {mode === 'demo' && <InfoNote>Sample notices demonstrate changes in activity. They are not security findings about your device.</InfoNote>}
    {mode === 'device' && <InfoNote>First seen by IPWard means first present in an import. Apple’s report cannot show when an app first began contacting a domain.</InfoNote>}
    <View style={{ alignSelf: 'flex-start' }}><Button label="Manage alert preferences" variant="secondary" icon="sliders" onPress={() => navigate('Protect')}/></View>
  </View>;
}
