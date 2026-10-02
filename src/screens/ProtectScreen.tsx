import React, { useState } from 'react';
import { Switch, TextInput, View } from 'react-native';
import { Badge, Button, Card, Icon, InfoNote, Metric, Pill, SectionHeading, styles, Txt } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { filterByRange } from '../services/analytics';

const presetRules: Record<string, string[]> = {
  Observe: [],
  Standard: ['ad.doubleclick.net', 'events.appsflyer.com', 'app.adjust.com'],
  Strict: ['ad.doubleclick.net', 'events.appsflyer.com', 'app.adjust.com', 'www.google-analytics.com', 'app-measurement.com'],
};
const domainPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function ProtectScreen() {
  const t = useTheme();
  const { mode, dataset, range, blockedDomains, toggleDomain, settings, updateSettings, toast, navigate } = useApp();
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');
  const [undo, setUndo] = useState<string[] | null>(null);
  const [query, setQuery] = useState('');
  const events = filterByRange(dataset.connections, range, dataset.generatedAt);
  const matches = events.filter(event => blockedDomains.includes(event.domain.toLowerCase()));
  const selectedPreset = Object.keys(presetRules).find(name => presetRules[name].length === blockedDomains.length && presetRules[name].every(item => blockedDomains.includes(item))) ?? 'Custom';
  const applyRules = (domains: string[], label: string) => {
    setUndo([...blockedDomains]);
    [...new Set([...blockedDomains, ...domains])].forEach(item => { if (blockedDomains.includes(item) !== domains.includes(item)) toggleDomain(item); });
    toast(`${label} saved locally. No device traffic is blocked.`);
  };
  const addDomain = () => {
    const value = domain.trim().toLowerCase();
    if (!domainPattern.test(value) || value.includes('..')) { setError('Enter a complete domain such as analytics.example.com. Leave out https://, paths, wildcards, and IP addresses.'); return; }
    if (blockedDomains.includes(value)) { setError('That domain already has a sample rule.'); return; }
    applyRules([...blockedDomains, value], 'Sample rule'); setDomain(''); setError('');
  };
  return <View style={styles.stack}>
    <Card style={{ backgroundColor: t.blueTint, borderColor: t.blueTint }}>
      <View style={{ ...styles.row, alignItems: 'flex-start' }}><View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface }}><Icon name="sliders" color={t.blue} size={21} /></View><View style={{ flex: 1 }}><Txt size={18} weight="600">Your rules. Your control.</Txt><Txt color={t.muted} size={13} style={{ marginTop: 5 }}>Explore how domain rules would affect sample activity. Network filtering is unavailable in this build.</Txt><View style={{ marginTop: 8 }}><Badge state="Unavailable" /></View></View></View>
    </Card>
    <View style={styles.wrap}><Metric label="Sample rules" value={blockedDomains.length} icon="list" detail="Saved on this device" /><Metric label="Matching sample events" value={mode === 'demo' ? matches.length.toLocaleString() : '—'} icon="filter" state={mode === 'demo' ? 'Observed' : 'Unavailable'} detail={mode === 'demo' ? `${range} · Simulation only` : 'No device observation source'} /><Metric label="Traffic blocked" value="—" icon="slash" state="Unavailable" detail="No active filtering service" /></View>
    <Card>
      <SectionHeading title="Rule presets" subtitle="Changes the local sample rule list" />
      <View style={styles.wrap}>{Object.keys(presetRules).map(name => <Pill key={name} label={name} active={selectedPreset === name} onPress={() => applyRules(presetRules[name], `${name} preset`)} />)}{selectedPreset === 'Custom' && <Pill label="Custom" active onPress={() => undefined} />}</View>
      <Txt color={t.muted} size={12} style={{ marginTop: 17 }}>{selectedPreset === 'Observe' ? 'Keep every sample connection visible without any matching rules.' : selectedPreset === 'Standard' ? 'Three example advertising and attribution endpoints. App-service endpoints stay outside this preset.' : selectedPreset === 'Strict' ? 'Adds two example analytics endpoints to the Standard list.' : 'Your own exact-domain rules are selected.'}</Txt>
      <InfoNote>Real domain blocking can break sign-in, content delivery, and other app features. These controls only simulate matches; they do not enable protection.</InfoNote>
    </Card>
    <Card>
      <SectionHeading title="Custom domain rules" subtitle="Exact domains only · No subdomain or IP matching" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}><TextInput accessibilityLabel="Domain for sample rule" value={domain} onChangeText={value => { setDomain(value); setError(''); }} onSubmitEditing={addDomain} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="analytics.example.com" placeholderTextColor={t.subtle} style={{ color: t.text, backgroundColor: t.background, minHeight: 47, paddingHorizontal: 14, flex: 1, minWidth: 170, borderWidth: 1, borderColor: error ? t.red : t.border, borderRadius: 10, fontSize: 13 }} /><Button label="Add rule" icon="plus" onPress={addDomain} /></View>
      {!!error && <Txt accessibilityRole="alert" color={t.red} size={12} style={{ marginTop: 10 }}>{error}</Txt>}
      {undo !== null && <View style={{ ...styles.between, marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: t.elevated }}><Txt size={12} color={t.muted} style={{ flex: 1 }}>Sample rules updated locally.</Txt><Button label="Undo" icon="rotate-ccw" variant="ghost" small onPress={() => { const previous = undo; applyRules(previous, 'Previous rules'); setUndo(null); }} /></View>}
      {blockedDomains.length > 4 && <TextInput accessibilityLabel="Search sample rules" placeholder="Search rules" placeholderTextColor={t.subtle} value={query} onChangeText={setQuery} style={{ minHeight: 45, color: t.text, marginTop: 12, borderBottomWidth: 1, borderColor: t.border }} />}
      <View style={{ marginTop: 19 }}>
        {blockedDomains.filter(item => item.includes(query.toLowerCase())).map(item => <View key={item} style={{ ...styles.row, paddingVertical: 14, borderTopWidth: 1, borderColor: t.border }}><Icon name="globe" color={t.blue} size={17} /><View style={{ flex: 1 }}><Txt size={13}>{item}</Txt><Txt size={11} color={t.muted}>{mode === 'demo' ? `${events.filter(event => event.domain === item).length} matching sample events` : 'Match simulation unavailable in device mode'}</Txt></View><Button label="Remove" small variant="ghost" onPress={() => applyRules(blockedDomains.filter(rule => rule !== item), 'Rule removal')} /></View>)}
        {!blockedDomains.length && <View style={{ alignItems: 'center', gap: 8, paddingVertical: 20 }}><Icon name="list" size={24} /><Txt size={14}>No sample rules yet</Txt><Txt color={t.muted} size={12}>Choose a preset or add a complete domain.</Txt></View>}
        {!!blockedDomains.length && !blockedDomains.some(item => item.includes(query.toLowerCase())) && <Txt size={12} color={t.muted}>No rules match your search.</Txt>}
      </View>
    </Card>
    <Card><SectionHeading title="Privacy preferences" subtitle="Stored locally and remembered between sessions" /><View style={{ ...styles.row, paddingVertical: 12 }}><Icon name="bell" /><View style={{ flex: 1 }}><Txt size={14}>Activity notices</Txt><Txt size={12} color={t.muted}>Show in-app sample activity alerts.</Txt></View><Switch accessibilityLabel="Activity notices" value={settings.alerts} onValueChange={value => updateSettings({ alerts: value })} trackColor={{ false: t.border, true: t.blue }} thumbColor={t.surface} /></View><View style={{ ...styles.row, paddingVertical: 17, borderTopWidth: 1, borderColor: t.border }}><Icon name="hard-drive" color={t.cyan} /><View style={{ flex: 1 }}><Txt size={14}>Local processing</Txt><Txt size={12} color={t.muted}>Rules and preferences stay in app storage.</Txt></View><Txt color={t.cyan} size={12}>Active</Txt></View><Button label="Trust & transparency" variant="secondary" icon="arrow-up-right" onPress={() => navigate('Trust')} /></Card>
  </View>;
}
