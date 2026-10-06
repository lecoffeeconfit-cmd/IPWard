import React from 'react';
import { Pressable, View } from 'react-native';
import { AppProfile, ConnectionCategory, ConnectionEvent, DataMode, Organization } from '../types';
import { useTheme } from '../theme';
import { Badge, Card, Icon, IconName, InfoNote, SectionHeading, Txt, styles } from './ui';

const purposeByCategory: Record<ConnectionCategory, string> = {
  'App service': 'Core feature or API',
  CDN: 'Content delivery',
  Authentication: 'Sign-in or token service',
  Cloud: 'Sync or storage',
  Analytics: 'Usage or performance measurement',
  Advertising: 'Ad delivery or measurement',
  Attribution: 'Install or campaign attribution',
  Marketing: 'Engagement tooling',
  Telemetry: 'App diagnostics',
  'Crash reporting': 'Error reporting',
  Communication: 'Messaging infrastructure',
  Unknown: 'Purpose unavailable',
};

const marketingCategories = new Set<ConnectionCategory>(['Analytics', 'Advertising', 'Attribution', 'Marketing']);

function DashboardPanel({ title, subtitle, icon, color, state, children }: { title: string; subtitle: string; icon: IconName; color: string; state: string; children: React.ReactNode }) {
  const t = useTheme();
  return <View style={{ flex: 1, minWidth: 225, padding: 15, borderRadius: 16, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border }}>
    <View style={{ ...styles.between, alignItems: 'flex-start' }}><View style={{ flex: 1 }}><View style={styles.row}><Icon name={icon} size={15} color={color}/><Txt size={11} color={color} weight="700" style={{ letterSpacing: .7 }}>{title}</Txt></View><Txt size={10} color={t.muted} style={{ marginTop: 6 }}>{subtitle}</Txt></View><Badge state={state}/></View>
    <View style={{ marginTop: 10 }}>{children}</View>
  </View>;
}

function RankedRow({ label, detail, value, ratio, color, onPress }: { label: string; detail: string; value: string | number; ratio: number; color: string; onPress: () => void }) {
  const t = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}. ${detail}`} onPress={onPress} style={({ pressed }) => ({ paddingVertical: 10, borderTopWidth: 1, borderColor: t.border, opacity: pressed ? .62 : 1 })}>
    <View style={{ ...styles.between, gap: 8 }}><View style={{ flex: 1, minWidth: 0 }}><Txt size={12} weight="600" numberOfLines={1}>{label}</Txt><Txt size={10} color={t.subtle} numberOfLines={1}>{detail}</Txt></View><Txt size={13} color={color} weight="700">{value}</Txt><Icon name="chevron-right" size={13}/></View>
    <View style={{ height: 3, borderRadius: 2, backgroundColor: t.surface, marginTop: 7, overflow: 'hidden' }}><View style={{ height: 3, width: `${Math.max(4, Math.min(100, ratio * 100))}%`, borderRadius: 2, backgroundColor: color }}/></View>
  </Pressable>;
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Txt size={11} color={t.subtle} style={{ paddingVertical: 14 }}>{children}</Txt>;
}

export function ConnectionOverviewDashboard({ events, apps, organizations, mode, onOpenConnection, onOpenApp }: { events: readonly ConnectionEvent[]; apps: readonly AppProfile[]; organizations: readonly Organization[]; mode: DataMode; onOpenConnection: (id: string) => void; onOpenApp: (id: string) => void }) {
  const t = useTheme();
  const categories = [...new Set(events.map(event => event.category))].map(category => ({ category, count: events.filter(event => event.category === category).length, first: events.find(event => event.category === category)! })).sort((a, b) => b.count - a.count);
  const appRows = [...new Set(events.map(event => event.appId).filter((id): id is string => Boolean(id)))].map(appId => { const selected = events.filter(event => event.appId === appId); return { app: apps.find(app => app.id === appId), count: selected.length, domains: new Set(selected.map(event => event.domain)).size }; }).filter(row => row.app).sort((a, b) => b.count - a.count);
  const background = events.filter(event => event.foregroundState === 'background');
  const backgroundRows = [...new Set(background.map(event => event.category))].map(category => ({ category, count: background.filter(event => event.category === category).length, first: background.find(event => event.category === category)! })).sort((a, b) => b.count - a.count);
  const providerCount = new Set(events.map(event => event.organizationId).filter((id): id is string => Boolean(id) && organizations.some(organization => organization.id === id))).size;
  const classified = events.filter(event => event.category !== 'Unknown').length;
  const marketing = events.filter(event => marketingCategories.has(event.category)).length;
  const maxCategory = Math.max(1, ...categories.map(row => row.count));
  const maxApp = Math.max(1, ...appRows.map(row => row.count));
  const maxBackground = Math.max(1, ...backgroundRows.map(row => row.count));

  return <Card style={{ backgroundColor: t.light ? '#F3F5F2' : '#182126' }}>
    <SectionHeading title="Connection intelligence" subtitle="A clean view of likely purpose, active apps, and background patterns"/>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 14 }}>
      {[{ label: 'Classified', value: `${classified}/${events.length}`, color: t.blue }, { label: 'Providers', value: providerCount, color: t.cyan }, { label: 'Marketing signals', value: marketing, color: t.amber }].map(item => <View key={item.label} style={{ flex: 1, minWidth: 115, padding: 11, borderRadius: 12, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }}><Txt size={9} color={item.color} weight="700" style={{ letterSpacing: .65, textTransform: 'uppercase' }}>{item.label}</Txt><Txt size={20} weight="600" style={{ marginTop: 3 }}>{item.value}</Txt></View>)}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <DashboardPanel title="LIKELY SERVICE PURPOSE" subtitle="Based on endpoint classification" icon="compass" color={t.blue} state={mode === 'device' ? 'Estimated' : 'Observed'}>{categories.slice(0, 5).map(row => <RankedRow key={row.category} label={row.category} detail={purposeByCategory[row.category]} value={row.count} ratio={row.count / maxCategory} color={t.blue} onPress={() => onOpenConnection(row.first.id)}/>)}{!categories.length && <EmptyPanel>No classified connections in this view.</EmptyPanel>}</DashboardPanel>
      <DashboardPanel title="MOST ACTIVE APPS" subtitle="Connections and unique domains" icon="grid" color={t.cyan} state={mode === 'device' ? 'Confirmed' : 'Observed'}>{appRows.slice(0, 5).map(row => <RankedRow key={row.app!.id} label={row.app!.name} detail={`${row.domains} unique domain${row.domains === 1 ? '' : 's'}`} value={row.count} ratio={row.count / maxApp} color={t.cyan} onPress={() => onOpenApp(row.app!.id)}/>)}{!appRows.length && <EmptyPanel>No attributed apps in this view.</EmptyPanel>}</DashboardPanel>
      <DashboardPanel title="BACKGROUND PATTERNS" subtitle={mode === 'device' ? 'Foreground state is not supplied by Apple reports' : 'Endpoint types contacted outside active use'} icon="moon" color={t.amber} state={mode === 'device' ? 'Unavailable' : 'Observed'}>{mode === 'device' ? <EmptyPanel>Unavailable from the imported report source.</EmptyPanel> : backgroundRows.slice(0, 5).map(row => <RankedRow key={row.category} label={row.category} detail={purposeByCategory[row.category]} value={row.count} ratio={row.count / maxBackground} color={t.amber} onPress={() => onOpenConnection(row.first.id)}/>)}{mode !== 'device' && !backgroundRows.length && <EmptyPanel>No background connections in this view.</EmptyPanel>}</DashboardPanel>
    </View>
    <InfoNote icon="compass">“Likely purpose” describes the service category associated with an endpoint. It does not reveal encrypted payload contents or prove why a specific transfer occurred. Tap any row for its supporting record.</InfoNote>
  </Card>;
}

export function AppOverviewDashboard({ events, apps, mode, onOpenApp }: { events: readonly ConnectionEvent[]; apps: readonly AppProfile[]; mode: DataMode; onOpenApp: (id: string) => void }) {
  const t = useTheme();
  const rows = apps.map(app => { const selected = events.filter(event => event.appId === app.id); return { app, count: selected.length, domains: new Set(selected.map(event => event.domain)).size, background: selected.filter(event => event.foregroundState === 'background').length, marketing: selected.filter(event => marketingCategories.has(event.category) || event.potentialTracker).length }; }).filter(row => row.count > 0);
  const active = [...rows].sort((a, b) => b.count - a.count);
  const background = [...rows].filter(row => row.background > 0).sort((a, b) => b.background - a.background);
  const marketing = [...rows].filter(row => row.marketing > 0).sort((a, b) => b.marketing - a.marketing);
  const maxActive = Math.max(1, ...active.map(row => row.count));
  const maxBackground = Math.max(1, ...background.map(row => row.background));
  const maxMarketing = Math.max(1, ...marketing.map(row => row.marketing));
  const appsWithActivity = rows.length;
  const uniqueDomains = new Set(events.map(event => event.domain)).size;

  return <Card style={{ backgroundColor: t.light ? '#F4F2F7' : '#201E28' }}>
    <SectionHeading title="App comparison dashboard" subtitle="Compare app activity without replacing the detailed profiles below"/>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 14 }}>
      {[{ label: 'Apps active', value: appsWithActivity, color: t.cyan }, { label: 'Unique domains', value: uniqueDomains, color: t.blue }, { label: 'Apps with signals', value: marketing.length, color: t.amber }].map(item => <View key={item.label} style={{ flex: 1, minWidth: 115, padding: 11, borderRadius: 12, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }}><Txt size={9} color={item.color} weight="700" style={{ letterSpacing: .65, textTransform: 'uppercase' }}>{item.label}</Txt><Txt size={20} weight="600" style={{ marginTop: 3 }}>{item.value}</Txt></View>)}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <DashboardPanel title="MOST NETWORK ACTIVITY" subtitle="Connections and domain variety" icon="activity" color={t.blue} state={mode === 'device' ? 'Confirmed' : 'Observed'}>{active.slice(0, 5).map(row => <RankedRow key={row.app.id} label={row.app.name} detail={`${row.domains} unique domain${row.domains === 1 ? '' : 's'}`} value={row.count} ratio={row.count / maxActive} color={t.blue} onPress={() => onOpenApp(row.app.id)}/>)}{!active.length && <EmptyPanel>No app network activity in this range.</EmptyPanel>}</DashboardPanel>
      <DashboardPanel title="BACKGROUND ACTIVITY" subtitle={mode === 'device' ? 'Not available in imported Apple reports' : 'Connections outside active app use'} icon="moon" color={t.cyan} state={mode === 'device' ? 'Unavailable' : 'Observed'}>{mode === 'device' ? <EmptyPanel>Foreground state is unavailable from this source.</EmptyPanel> : background.slice(0, 5).map(row => <RankedRow key={row.app.id} label={row.app.name} detail={`${Math.round(row.background / row.count * 100)}% of this app’s connections`} value={row.background} ratio={row.background / maxBackground} color={t.cyan} onPress={() => onOpenApp(row.app.id)}/>)}{mode !== 'device' && !background.length && <EmptyPanel>No background app activity in this range.</EmptyPanel>}</DashboardPanel>
      <DashboardPanel title="MARKETING & ANALYTICS" subtitle="Endpoints classified in related categories" icon="eye" color={t.amber} state={mode === 'device' ? 'Estimated' : 'Observed'}>{marketing.slice(0, 5).map(row => <RankedRow key={row.app.id} label={row.app.name} detail={`${Math.round(row.marketing / row.count * 100)}% of classified activity`} value={row.marketing} ratio={row.marketing / maxMarketing} color={t.amber} onPress={() => onOpenApp(row.app.id)}/>)}{!marketing.length && <EmptyPanel>No marketing or analytics signals in this range.</EmptyPanel>}</DashboardPanel>
    </View>
    <InfoNote icon="info">Tap an app to open its existing profile with destinations, permissions, confidence, and recent records. Category counts describe endpoints and do not prove personal-data collection.</InfoNote>
  </Card>;
}
