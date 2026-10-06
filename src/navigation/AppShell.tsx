import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DetailPanel } from '../components/DetailPanel';
import { SignalNav } from '../components/SignalNav';
import { WorkspaceTools } from '../components/WorkspaceTools';
import { Button, Icon, IconButton, IconName, Pill, Txt, styles } from '../components/ui';
import { Route, useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { primaryDestinations, sectionForRoute, sectionLabel, sectionLinks } from './sections';

const title: Record<Route, string> = {
  Overview: 'Your signal deck.', Network: 'Follow the outgoing signals.', Data: 'Understand the data journey.', Device: 'Know your device.', Activity: 'Every signal has a story.', Apps: 'Your apps, under the lens.', Connections: 'Follow the outgoing signals.', Protect: 'Shape your privacy.',
  Security: 'Device security, in context.', 'Device Checks': 'Device checks, in context.',
  'Privacy Map': 'See the whole data journey.', 'Web Privacy': 'Inspect the web before it follows you.',
  'Live Monitor': 'The connection feed.', Captures: 'Capture a closer look.', Trust: 'Trust & transparency.', Settings: 'Make IPward yours.', Communication: 'Communication activity.', Sensors: 'Sensors & access.', Marketing: 'Data & ads.', Destinations: 'Where connections go.', Alerts: 'Activity notices.',
};
const subtitle: Record<Route, string> = {
  Overview: 'Know what is accessed. See what leaves. Follow where it goes.', Network: 'Connections, destinations and history in one focused workspace.', Data: 'Apps, access categories, tracking clues and recipients.', Device: 'Sensitive access, device checks and connectivity in context.', Activity: 'A timeline of observable moments across your phone.', Apps: 'Understand what each application connects to and accesses.', Connections: 'Outside contacts and their evidence, in plain language.', Protect: 'Choose preferences and inspect sample protection rules.',
  Security: 'Review available evidence, check device settings, and know when deeper analysis is needed.', 'Device Checks': 'Review system guidance and connectivity diagnostics, with clear limits.',
  'Privacy Map': 'Map access, apps, recipients, purposes, account exports, and exposure scores.', 'Web Privacy': 'Review links locally and organize browser privacy controls.',
  'Live Monitor': 'Historical records and sample events, clearly separated.', Captures: 'Focus on one moment, then compare what changed.', Trust: 'What IPward knows, what it cannot see, and what stays local.', Settings: 'Adjust your workspace and take your data with you.', Communication: 'Useful signals, with honest limits on message counts.', Sensors: 'Resource access and permissions, kept distinct.', Marketing: 'See recorded access, domain contacts, ad signals, and phone controls.', Destinations: 'Explore organizations and connection endpoints.', Alerts: 'Changes worth a closer look, without alarm.',
};

function Mark({ size = 38 }: { size?: number }) {
  const t = useTheme();
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}><Svg width={size} height={size} viewBox="0 0 44 44"><Path d="M13 3 H31 L41 13 V31 L31 41 H13 L3 31 V13 Z" fill={t.elevated} stroke={t.blue} strokeWidth="1.5"/><Path d="M8 24 H15 L19 14 L24 31 L28 20 H36" fill="none" stroke={t.blue} strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round"/><Path d="M9 10 H16 M28 34 H35" stroke={t.cyan} strokeWidth="1.2" opacity="0.8"/></Svg></View>;
}
function NavItem({ route, label, icon, compact = false }: { route: Route; label: string; icon: IconName; compact?: boolean }) {
  const { route: current, navigate } = useApp();
  const t = useTheme();
  const active = route === sectionForRoute[current];
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={label} onPress={() => navigate(route)} style={({ pressed }) => ({ minHeight: compact ? 63 : 47, borderTopLeftRadius: 18, borderTopRightRadius: 8, borderBottomRightRadius: 18, borderBottomLeftRadius: 8, flexDirection: compact ? 'column' : 'row', alignItems: 'center', justifyContent: compact ? 'center' : 'flex-start', gap: compact ? 3 : 12, paddingHorizontal: compact ? 1 : 13, backgroundColor: active ? t.blueTint : pressed ? t.elevated : 'transparent', borderWidth: 1, borderColor: active ? t.blue : 'transparent', opacity: pressed ? 0.76 : 1 })}>
    <View style={{ width: compact ? 31 : 27, height: compact ? 31 : 27, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: active ? t.blue : t.elevated, shadowColor: t.blue, shadowOpacity: active && !t.light ? 0.5 : 0, shadowRadius: 9 }}><Icon name={icon} size={compact ? 16 : 15} color={active ? (t.light ? '#FFFFFF' : '#071B0D') : t.muted}/></View>
    <Txt size={compact ? 9 : 12} color={active ? t.blue : t.muted} weight={active ? '700' : '500'} numberOfLines={1}>{label}</Txt>
  </Pressable>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { route, mode, range, setRange, overviewTrends, setOverviewTrends, navigate, detail, openDetail, notice, ready, dataset, settings, updateSettings } = useApp();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = width >= 1000;
  const compact = width < 660;
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [route]);
  const durations = ['Live', 'Today', 'Yesterday', '7 days', '30 days'] as const;
  const ranges = route === 'Overview' ? ['Overview', ...durations] as const : durations;
  const withRange = !['Network', 'Data', 'Device', 'Device Checks', 'Captures', 'Trust', 'Settings', 'Protect', 'Security', 'Web Privacy'].includes(route);
  const query = search.trim().toLowerCase();
  const appMatches = query ? dataset.apps.filter(app => app.name.toLowerCase().includes(query)).slice(0, 5) : [];
  const orgMatches = query ? dataset.organizations.filter(org => org.name.toLowerCase().includes(query)).slice(0, 5) : [];
  const connectionMatches = query ? dataset.connections.filter(event => event.domain.toLowerCase().includes(query) || event.ip.includes(query)).slice(0, 6) : [];
  const choose = (type: 'app' | 'organization' | 'connection', id: string) => { setSearchOpen(false); setSearch(''); openDetail({ type, id }); };
  const hasReport = !!(dataset.connections.length || dataset.sensors.length);

  return <View style={{ flex: 1, flexDirection: 'row', backgroundColor: t.background }}>
    {desktop && <View style={{ width: 253, borderRightWidth: 1, borderRightColor: t.border, paddingHorizontal: 14, paddingTop: Math.max(insets.top, 20) + 7, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: t.surface }}>
      <LinearGradient colors={t.light ? ['#FFFFFF99', '#FFFFFF00'] : ['#66747A22', '#10141900']} style={{ pointerEvents: 'none', position: 'absolute', top: 0, left: 0, right: 0, height: 210 }}/>
      <View style={{ ...styles.row, gap: 11, paddingHorizontal: 8, marginBottom: 33 }}><Mark/><View><Txt size={20} weight="700" style={{ letterSpacing: -0.9 }}>IPward</Txt><Txt size={9} color={t.blue} weight="700" style={{ letterSpacing: 1.6 }}>PRIVACY / VISIBLE</Txt></View></View>
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}><Txt size={9} color={t.subtle} weight="700" style={{ letterSpacing: 1.8, marginBottom: 12, marginLeft: 12 }}>SIGNAL DECK</Txt>{primaryDestinations.map(item => <NavItem {...item} key={item.route}/>)}</ScrollView>
      <View style={{ borderTopWidth: 1, borderTopColor: t.border, paddingTop: 14 }}><View style={{ ...styles.row, paddingHorizontal: 12, gap: 8 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: mode === 'demo' ? t.purple : t.cyan }}/><Txt size={10} color={t.muted}>{mode === 'demo' ? 'Sample workspace' : hasReport ? 'Imported report · historical' : 'Device · no provider'}</Txt></View><Txt size={9} color={t.subtle} style={{ marginTop: 9, marginHorizontal: 12, lineHeight: 14 }}>Related tools are organized inside each page.</Txt></View>
    </View>}
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ height: desktop ? 82 : Math.max(insets.top, 10) + 57, borderBottomWidth: 1, borderBottomColor: t.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: desktop ? 0 : Math.max(insets.top, 10), paddingHorizontal: desktop ? 32 : compact ? 15 : 25, backgroundColor: t.surface }}>
        <LinearGradient colors={t.light ? ['#FFFFFF', '#E5EBE9'] : ['#303A41', '#1A2026']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ pointerEvents: 'none', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}/>
        <View style={{ ...styles.row, gap: 10 }}>{!desktop && <Mark size={35}/>}<View><Txt size={desktop ? 10 : 17} weight="700" color={desktop ? t.blue : t.text} style={{ letterSpacing: desktop ? 1.7 : -0.4 }}>{desktop ? 'LOCAL / INSTRUMENT PANEL' : 'IPward'}</Txt>{!desktop && <Txt size={8} color={t.blue} weight="700" style={{ letterSpacing: 1.25 }}>PRIVACY / VISIBLE</Txt>}</View></View>
        <View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel="Search activity" onPress={() => setSearchOpen(true)} style={{ height: 41, minWidth: compact ? 41 : 166, paddingHorizontal: compact ? 10 : 13, backgroundColor: t.elevated, borderTopLeftRadius: 19, borderTopRightRadius: 8, borderBottomRightRadius: 19, borderBottomLeftRadius: 8, borderWidth: 1, borderColor: t.border, flexDirection: 'row', alignItems: 'center', gap: 9 }}><Icon name="search" size={16}/>{!compact && <Txt size={11} color={t.subtle}>Search signals</Txt>}</Pressable><IconButton name={settings.light ? 'moon' : 'sun'} label={settings.light ? 'Switch to dark mode' : 'Switch to light mode'} onPress={() => updateSettings({ light: !settings.light })}/>{compact ? <IconButton name="aperture" label="Start capture" onPress={() => navigate('Captures')}/> : <Button label="Start capture" icon="aperture" small onPress={() => navigate('Captures')}/ >}{!compact && <IconButton name="bell" label="Activity notices" onPress={() => navigate('Alerts')}/>}</View>
      </View>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: desktop ? 32 : compact ? 16 : 25, paddingTop: desktop ? 30 : 22, paddingBottom: compact ? 122 : 50, maxWidth: 1390, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ ...styles.between, alignItems: 'flex-start', marginBottom: compact ? 20 : 25 }}><View style={{ flex: 1 }}><Txt size={10} color={t.blue} weight="700" style={{ letterSpacing: 2.3, marginBottom: 6 }}>{route === 'Overview' ? 'HOME / OVERVIEW' : route === 'Marketing' ? 'DATA & ADS' : route.toUpperCase()}</Txt><Txt size={compact ? 29 : 38} weight="500" style={{ letterSpacing: -1.45, lineHeight: compact ? 37 : 46 }}>{title[route]}</Txt><Txt size={compact ? 12 : 13} color={t.muted} style={{ marginTop: 6, maxWidth: 650 }}>{subtitle[route]}</Txt></View>{!compact && <Txt size={11} color={t.muted}>{new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</Txt>}</View>
        <Pressable accessibilityRole="button" accessibilityLabel={mode === 'demo' ? 'Sample data details' : 'Device capabilities'} onPress={() => navigate('Trust')} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 11, borderTopLeftRadius: 16, borderTopRightRadius: 7, borderBottomRightRadius: 16, borderBottomLeftRadius: 7, borderWidth: 1, borderColor: mode === 'demo' ? t.purple : t.cyan, backgroundColor: mode === 'demo' ? t.purpleTint : t.cyanTint, marginBottom: 21 }}><Icon name={mode === 'demo' ? 'eye' : 'info'} size={15} color={mode === 'demo' ? t.purple : t.cyan}/><Txt size={11} color={mode === 'demo' ? t.purple : t.cyan} style={{ flex: 1 }}>{mode === 'demo' ? 'SAMPLE PREVIEW  /  Illustrative events, not activity from your phone' : hasReport ? 'IMPORTED REPORT  /  Historical records. Live monitoring is not connected.' : 'DEVICE MODE  /  No imported report or live monitoring provider connected.'}</Txt><Icon name="arrow-up-right" size={14} color={mode === 'demo' ? t.purple : t.cyan}/></Pressable>
        {withRange && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>{ranges.map(item => <Pill key={item} label={item} icon={item === 'Overview' ? 'bar-chart-2' : undefined} active={item === 'Overview' ? overviewTrends : range === item && (route !== 'Overview' || !overviewTrends)} onPress={() => { if (item === 'Overview') setOverviewTrends(true); else { setOverviewTrends(false); setRange(item); } }}/>)}</ScrollView>}
        {route !== 'Overview' && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 20 }} accessibilityLabel={`${sectionLabel(sectionForRoute[route])} views`}><Pill label={sectionLabel(sectionForRoute[route])} active={route === sectionForRoute[route]} onPress={() => navigate(sectionForRoute[route])}/>{sectionLinks[sectionForRoute[route]].map(link => <Pill key={link.route} label={link.title} active={route === link.route} onPress={() => navigate(link.route)}/>)}</ScrollView>}
        {ready ? <>{children}<WorkspaceTools route={route}/></> : <View style={{ paddingVertical: 50, alignItems: 'center' }}><Txt color={t.muted}>Opening your local workspace…</Txt></View>}
      </ScrollView>
      {!desktop && <SignalNav bottomInset={insets.bottom}/>}
    </View>
    {!!notice && <View accessibilityLiveRegion="polite" style={{ position: 'absolute', bottom: compact ? 96 : 24, left: desktop ? 270 : 16, right: 16, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border, borderRadius: 14, padding: 14 }}><Txt size={12}>{notice}</Txt></View>}
    {searchOpen && <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#000A', paddingTop: Math.max(insets.top, 20) + 35, alignItems: 'center', zIndex: 20 }}><View style={{ width: '92%', maxWidth: 560, maxHeight: '75%', backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 22, padding: 18 }}><View style={styles.row}><Icon name="search"/><TextInput accessibilityLabel="Search apps, companies, and domains" autoFocus value={search} onChangeText={setSearch} placeholder="Search apps, companies, domains, or IPs" placeholderTextColor={t.subtle} style={{ flex: 1, height: 44, color: t.text, fontSize: 14 }}/><IconButton name="x" label="Close search" onPress={() => setSearchOpen(false)}/></View><ScrollView keyboardShouldPersistTaps="handled"><View style={{ height: 1, backgroundColor: t.border, marginVertical: 9 }}/>{query ? [...appMatches.map(app => ({ type: 'app' as const, id: app.id, label: app.name, meta: 'Application' })), ...orgMatches.map(org => ({ type: 'organization' as const, id: org.id, label: org.name, meta: 'Organization' })), ...connectionMatches.map(event => ({ type: 'connection' as const, id: event.id, label: event.domain, meta: 'Connection' }))].map((result, index) => <Pressable key={`${result.type}-${result.id}-${index}`} accessibilityRole="button" onPress={() => choose(result.type, result.id)} style={{ paddingVertical: 13, borderBottomWidth: 1, borderColor: t.border }}><Txt size={13}>{result.label}</Txt><Txt size={10} color={t.muted}>{result.meta}</Txt></Pressable>) : <Txt color={t.muted} size={12} style={{ padding: 15 }}>Search this workspace.</Txt>}{query && !appMatches.length && !orgMatches.length && !connectionMatches.length && <Txt color={t.muted} size={12} style={{ padding: 15 }}>No matches in this workspace.</Txt>}</ScrollView></View><Pressable accessibilityRole="button" accessibilityLabel="Dismiss search" onPress={() => setSearchOpen(false)} style={{ flex: 1, width: '100%' }}/></View>}
    <DetailPanel detail={detail} onClose={() => openDetail(null)}/>
  </View>;
}
