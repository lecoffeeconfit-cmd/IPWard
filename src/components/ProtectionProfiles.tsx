import React from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { createNetworkRule } from '../services/networkRules';
import { useApp } from '../state/AppContext';
import { ProtectionMode } from '../types';
import { useTheme } from '../theme';
import { Button, Icon, IconName, InfoNote, SectionHeading, Txt } from './ui';

const profiles: { id: ProtectionMode; icon: IconName; detail: string; rules: { action: 'alert' | 'block'; category: string }[] }[] = [
  { id: 'Standard', icon: 'activity', detail: 'Activity notices and balanced local review.', rules: [] },
  { id: 'Privacy', icon: 'eye-off', detail: 'Enhanced review with alerts for advertising and attribution records.', rules: [{ action: 'alert', category: 'Advertising' }, { action: 'alert', category: 'Attribution' }] },
  { id: 'Strict Privacy', icon: 'shield', detail: 'Block previews for marketing categories in loaded evidence.', rules: [{ action: 'block', category: 'Advertising' }, { action: 'block', category: 'Attribution' }, { action: 'block', category: 'Marketing' }, { action: 'alert', category: 'Analytics' }] },
  { id: 'High-Risk Protection', icon: 'alert-triangle', detail: 'Enhanced review, alerts, longer evidence retention, and high-risk guidance.', rules: [{ action: 'alert', category: 'Advertising' }, { action: 'alert', category: 'Attribution' }, { action: 'alert', category: 'Marketing' }, { action: 'alert', category: 'Analytics' }, { action: 'alert', category: 'Unknown' }] },
];

export function ProtectionProfiles() {
  const { settings, updateSettings, networkRules, addNetworkRule, removeNetworkRule, toast, navigate } = useApp();
  const t = useTheme();
  const apply = (profile: typeof profiles[number], now: number) => {
    networkRules.filter(rule => rule.id.startsWith('profile-')).forEach(rule => removeNetworkRule(rule.id));
    profile.rules.forEach((entry, index) => {
      const rule = createNetworkRule(entry.action, 'category', entry.category, now + index);
      if (rule) addNetworkRule({ ...rule, id: `profile-${profile.id.toLowerCase().replace(/\W+/g, '-')}-${entry.category.toLowerCase()}` });
    });
    updateSettings({ protection: profile.id, alerts: true, monitoring: profile.id === 'Standard' ? 'Standard' : 'Enhanced', ...(profile.id === 'High-Risk Protection' && settings.retention !== 0 && settings.retention < 90 ? { retention: 90 } : {}) });
    toast(`${profile.id} profile applied locally. Category rules are previews until filtering is connected.`);
  };
  const active = profiles.find(profile => profile.id === settings.protection) ?? profiles[0];
  return <View>
    <SectionHeading title="Protection profile" subtitle="One place for alert sensitivity, retention, and local rule previews"/>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>{profiles.map(profile => {
      const selected = settings.protection === profile.id;
      return <Pressable key={profile.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => apply(profile, Date.now())} style={({ pressed }) => ({ flexGrow: 1, flexBasis: 190, minWidth: 165, minHeight: 112, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: selected ? (profile.id === 'High-Risk Protection' ? t.amber : t.blue) : t.border, backgroundColor: selected ? (profile.id === 'High-Risk Protection' ? t.amberTint : t.blueTint) : pressed ? t.elevated : t.surface, opacity: pressed ? .72 : 1 })}><Icon name={profile.icon} color={selected ? (profile.id === 'High-Risk Protection' ? t.amber : t.blue) : t.muted}/><Txt size={12} weight="700" style={{ marginTop: 8 }}>{profile.id}</Txt><Txt size={10} color={t.muted} style={{ marginTop: 3 }}>{profile.detail}</Txt></Pressable>;
    })}</View>
    <View style={{ marginTop: 13, padding: 13, borderRadius: 12, backgroundColor: t.elevated }}><Txt size={11} weight="700" color={settings.protection === 'High-Risk Protection' ? t.amber : t.cyan}>{active.id.toUpperCase()} IS ACTIVE</Txt><Txt size={11} color={t.muted} style={{ marginTop: 4 }}>{active.rules.length ? `${active.rules.length} profile-managed category rules · ` : 'No profile-managed category rules · '}{settings.alerts ? 'notices on' : 'notices off'} · {settings.monitoring} observation preference · {settings.retention === 0 ? 'unlimited' : `${settings.retention}-day`} retention</Txt></View>
    {settings.protection === 'High-Risk Protection' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}><Button small label="Open Security Center" icon="shield" variant="secondary" onPress={() => navigate('Security')}/>{Platform.OS === 'ios' && <Button small label="Apple Lockdown Mode guide" icon="external-link" variant="ghost" onPress={() => { void Linking.openURL('https://support.apple.com/105120').catch(() => toast('The Lockdown Mode guide could not be opened.')); }}/>}</View>}
    <InfoNote>Profiles change IPward’s local review preferences and saved rule previews. They do not activate a VPN, Safari extension, URL filter, or device-wide blocker in this build.</InfoNote>
  </View>;
}
