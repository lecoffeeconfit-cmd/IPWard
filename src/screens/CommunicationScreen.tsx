import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Button, Card, EmptyState, Icon, InfoNote, Metric, SectionHeading, styles, Txt } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { filterByRange } from '../services/analytics';
import { ChartPanel, HorizontalBarChart, HourlyBarChart } from '../components/DashboardCharts';

const duration = (seconds: number) => seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

export function CommunicationScreen() {
  const t = useTheme();
  const { dataset, range, mode, setMode, openDetail, navigate } = useApp();
  const [explanation, setExplanation] = useState(false);
  const events = useMemo(() => filterByRange(dataset.communications, range, dataset.generatedAt), [dataset, range]);
  const calls = events.filter(event => event.type === 'call');
  const usage = events.filter(event => event.type === 'app-usage');
  const email = events.filter(event => event.type === 'email');
  const emailReceived = email.filter(event => event.direction === 'incoming').reduce((sum, event) => sum + event.count, 0);
  const emailSent = email.filter(event => event.direction === 'outgoing').reduce((sum, event) => sum + event.count, 0);
  const notifications = events.filter(event => event.type === 'notification').reduce((sum, event) => sum + event.count, 0);
  const totalUsage = usage.reduce((sum, event) => sum + event.durationSeconds, 0);
  const appUsage = dataset.apps.map(app => ({ app, seconds: usage.filter(event => event.appId === app.id).reduce((sum, event) => sum + event.durationSeconds, 0) })).filter(item => item.seconds > 0).sort((a, b) => b.seconds - a.seconds);
  const hourly = Array.from({ length: 24 }, (_, hour) => events.filter(event => new Date(event.timestamp).getHours() === hour).length);
  const typeRows = [
    { id: 'app-usage', label: 'App activity records', value: usage.length, detail: 'Time summaries, not message counts', color: t.blue },
    { id: 'call', label: 'Call records', value: calls.length, detail: 'Sample metadata rows', color: t.cyan },
    { id: 'email', label: 'Email records', value: email.length, detail: 'Sample metadata rows', color: t.purple },
    { id: 'notification', label: 'Notification records', value: events.filter(event => event.type === 'notification').length, detail: 'Not message counts', color: t.amber },
  ].filter(row => row.value > 0);
  const usageRows = appUsage.slice(0, 6).map(({ app, seconds }) => ({ id: app.id, label: app.name, value: seconds, displayValue: duration(seconds), detail: 'Sample foreground activity', color: app.color }));
  if (mode === 'device') return <View style={styles.stack}><EmptyState title="Communication activity is unavailable" description="No authorized communication source is connected. This build cannot read your messages, call history, notifications, or another app’s usage." icon="message-circle" action="Explore sample communication" onAction={() => setMode('demo')} /><Card><SectionHeading title="Connect on your terms" subtitle="Email integration foundation" /><Badge state="Unavailable" /><Txt size={13} color={t.muted} style={{ marginVertical: 12 }}>Gmail and Outlook connections are not implemented in this build. No account is connected and no email is read.</Txt><Button label="View capabilities" icon="arrow-up-right" variant="secondary" onPress={() => navigate('Trust')} /></Card></View>;
  return <View style={styles.stack}>
    <View style={styles.wrap}>
      <Metric label="App activity time" value={duration(totalUsage)} icon="clock" state={usage.length ? 'Confirmed' : 'Unavailable'} detail="Sample usage · not time spent texting" />
      <Metric label="Calls" value={calls.reduce((sum, event) => sum + event.count, 0)} icon="phone" state={calls.length ? 'Confirmed' : 'Unavailable'} detail={`${duration(calls.reduce((sum, event) => sum + event.durationSeconds, 0))} total · Sample records`} />
      <Metric label="Notifications" value={notifications.toLocaleString()} icon="bell" state={events.some(event => event.type === 'notification') ? 'Observed' : 'Unavailable'} detail="Sample events · not message count" />
    </View>
    <Card style={{ backgroundColor: t.purpleTint, borderColor: t.purpleTint }}>
      <View style={{ ...styles.between, alignItems: 'flex-start' }}><View style={{ flex: 1 }}><View style={styles.row}><Icon name="message-circle" color={t.purple} size={20} /><Txt size={16} weight="600">Message activity</Txt></View><Txt size={12} color={t.muted} style={{ marginTop: 9 }}>Encrypted conversations stay private.</Txt></View><Badge state="Unavailable" /></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 28, marginVertical: 23 }}><View><Txt size={30} color={t.purple}>—</Txt><Txt size={12} color={t.muted}>Exact message count</Txt></View><View style={{ width: 1, backgroundColor: t.border }} /><View><Txt size={30} color={t.purple}>—</Txt><Txt size={12} color={t.muted}>Estimated activity windows</Txt></View></View>
      <Txt size={13} color={t.muted}>App time, notifications, and connection totals do not establish how many messages were sent or received. The sample lacks enough correlated signals for an estimate.</Txt>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: explanation }} onPress={() => setExplanation(value => !value)} style={{ ...styles.row, minHeight: 44, marginTop: 8 }}><Txt size={12} color={t.purple} weight="600">How would an estimate work?</Txt><Icon name={explanation ? 'chevron-up' : 'chevron-down'} color={t.purple} size={15} /></Pressable>
      {explanation && <View style={{ gap: 12, paddingTop: 7 }}><Txt size={12} color={t.muted}>A future supported source could correlate foreground activity with eligible notification and network events in a defined time window. The output would describe activity windows, with confidence, input signals, time, and algorithm version attached.</Txt><Txt size={12} color={t.muted}>It would still not reveal a message’s content, recipient, or an exact message count. Incoming and outgoing splits require their own evidence.</Txt></View>}
    </Card>
    <Card><SectionHeading title="Communication activity graphs" subtitle="A visual summary of the sample metadata currently available"/><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><ChartPanel title="ACTIVITY BY HOUR" subtitle={`${range} · metadata records`} color={t.purple}><HourlyBarChart values={hourly} color={t.purple} accessibilityLabel={`Communication metadata records by hour. ${events.length} total records.`}/></ChartPanel><ChartPanel title="RECORD MIX" subtitle="Available source types" color={t.blue}><HorizontalBarChart rows={typeRows} color={t.blue}/></ChartPanel><ChartPanel title="APP ACTIVITY TIME" subtitle="Sample foreground activity" color={t.cyan}><HorizontalBarChart rows={usageRows} color={t.cyan} onPress={row => openDetail({ type: 'app', id: row.id })}/></ChartPanel></View><InfoNote>These graphs summarize metadata records and app time. They do not represent message counts, conversation content, recipients, or time spent communicating.</InfoNote></Card>
    <View style={styles.wrap}>
      <Card style={{ flex: 1, minWidth: 260 }}>
        <SectionHeading title="Communication app activity" subtitle={`${range} · Simulated usage source`} />
        {appUsage.map(({ app, seconds }) => <Pressable key={app.id} accessibilityRole="button" onPress={() => openDetail({ type: 'app', id: app.id })} style={{ paddingVertical: 14, gap: 12 }}><View style={styles.between}><View style={styles.row}><View style={{ backgroundColor: `${app.color}22`, width: 31, height: 31, borderRadius: 9, justifyContent: 'center', alignItems: 'center' }}><Txt size={12} weight="600" color={app.color}>{app.initials}</Txt></View><Txt size={13}>{app.name}</Txt></View><Txt size={13}>{duration(seconds)}</Txt></View><View style={{ backgroundColor: t.elevated, height: 5, borderRadius: 4 }}><View style={{ width: `${seconds / Math.max(1, totalUsage) * 100}%`, height: 5, borderRadius: 4, backgroundColor: app.color }} /></View></Pressable>)}
        {!appUsage.length && <Txt size={13} color={t.muted}>No app activity in the selected sample period.</Txt>}
        <InfoNote>App activity may include reading, media, browsing, or idle time.</InfoNote>
      </Card>
      <Card style={{ flex: 1, minWidth: 260 }}>
        <SectionHeading title="Email activity" subtitle="Sample integration · No account connected" />
        <View style={{ flexDirection: 'row', gap: 35, marginVertical: 12 }}><View><Txt size={34} weight="500">{emailReceived}</Txt><Txt size={12} color={t.muted}>Received</Txt><Badge state={email.length ? 'Confirmed' : 'Unavailable'} /></View><View><Txt size={34} weight="500">{emailSent}</Txt><Txt size={12} color={t.muted}>Sent</Txt><Badge state={email.length ? 'Confirmed' : 'Unavailable'} /></View></View>
        <Txt size={12} color={t.muted} style={{ marginTop: 10, marginBottom: 18 }}>These counts illustrate a metadata-only integration. Email providers, account authorization, and live retrieval are not connected in this build.</Txt>
        <Button label="View integration status" icon="arrow-up-right" variant="secondary" onPress={() => navigate('Trust')} />
      </Card>
    </View>
    <Card>
      <SectionHeading title="Call activity" subtitle="Sample call records · Simulated authorized source" />
      {calls.slice(0, 12).map(event => <View key={event.id} style={{ ...styles.row, paddingVertical: 16, borderTopWidth: 1, borderColor: t.border }}><View style={{ width: 37, height: 37, borderRadius: 12, backgroundColor: t.blueTint, alignItems: 'center', justifyContent: 'center' }}><Icon name={event.direction === 'incoming' ? 'phone-incoming' : event.direction === 'outgoing' ? 'phone-outgoing' : 'phone'} color={t.blue} size={16} /></View><View style={{ flex: 1 }}><Txt size={13} weight="500">{dataset.apps.find(app => app.id === event.appId)?.name ?? 'Communication app'}</Txt><Txt size={11} color={t.muted}>{event.direction.charAt(0).toUpperCase() + event.direction.slice(1)} · {new Date(event.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Txt></View><View style={{ alignItems: 'flex-end' }}><Txt size={13}>{duration(event.durationSeconds)}</Txt><Badge state={event.provenance.state} onPress={() => openDetail({ type: 'evidence', id: event.provenance.state })} /></View></View>)}
      {!calls.length && <Txt color={t.muted} size={13}>No call records in the selected sample period.</Txt>}
      {calls.length > 12 && <Txt size={11} color={t.muted} style={{ marginTop: 14 }}>Showing the most recent 12 of {calls.length} sample calls. Summary includes the full selected period.</Txt>}
    </Card>
    <InfoNote>All activity on this screen is fictional sample data. Confirmed and Observed describe the illustrated source; they do not mean that this device or your accounts were accessed.</InfoNote>
  </View>;
}
