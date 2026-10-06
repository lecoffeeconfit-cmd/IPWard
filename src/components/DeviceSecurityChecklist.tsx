import React, { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';
import { Button, Icon, IconName, InfoNote, SectionHeading, Txt } from './ui';

type ReviewState = 'unreviewed' | 'reviewed' | 'attention';
type ReviewItem = { id: string; title: string; detail: string; icon: IconName };
const storageKey = 'ipward.deviceChecklist.v1';

const common: ReviewItem[] = [
  { id: 'updates', title: 'OS and security updates', detail: 'Confirm the newest update offered for this phone is installed.', icon: 'download-cloud' },
  { id: 'screen-lock', title: 'Screen lock and biometrics', detail: 'Review passcode strength and Face ID, Touch ID, or fingerprint enrollment.', icon: 'lock' },
  { id: 'vpn-dns', title: 'VPN and DNS configuration', detail: 'Check that every VPN, DNS profile, and traffic-filtering app is familiar.', icon: 'wifi' },
  { id: 'certificates', title: 'Trusted certificates', detail: 'Review user-installed certificates and remove only those you know are unwanted.', icon: 'award' },
  { id: 'permissions', title: 'Sensitive app permissions', detail: 'Review camera, microphone, location, photos, contacts, Bluetooth, local network, notifications, and background access.', icon: 'eye' },
  { id: 'account', title: 'Account and recovery access', detail: 'Review signed-in devices, recovery methods, and recent account security activity.', icon: 'user-check' },
];
const ios: ReviewItem[] = [
  { id: 'profiles', title: 'Profiles and device management', detail: 'Check for configuration or MDM profiles you do not recognize.', icon: 'layers' },
  { id: 'developer', title: 'Developer Mode', detail: 'Keep Developer Mode off unless you intentionally use it.', icon: 'code' },
  { id: 'lockdown', title: 'Lockdown Mode decision', detail: 'People facing sophisticated targeted attacks should consider Apple’s Lockdown Mode guidance.', icon: 'shield' },
];
const android: ReviewItem[] = [
  { id: 'special-access', title: 'Special app access', detail: 'Review Accessibility, device admin, overlays, notification access, install-unknown-apps, and usage access.', icon: 'sliders' },
  { id: 'play-protect', title: 'Play Protect and app sources', detail: 'Review Play Protect status and apps installed outside your normal store.', icon: 'shield' },
  { id: 'developer', title: 'Developer options and USB debugging', detail: 'Keep debugging and developer features off unless intentionally needed.', icon: 'code' },
];

function validSaved(value: unknown): value is Record<string, ReviewState> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(item => ['unreviewed', 'reviewed', 'attention'].includes(String(item)));
}

export function DeviceSecurityChecklist() {
  const t = useTheme();
  const items = [...common, ...(Platform.OS === 'ios' ? ios : Platform.OS === 'android' ? android : [...ios.slice(0, 1), ...android.slice(0, 1)])];
  const [states, setStates] = useState<Record<string, ReviewState>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => { AsyncStorage.getItem(storageKey).then(raw => { if (raw) { const parsed: unknown = JSON.parse(raw); if (validSaved(parsed)) setStates(parsed); } }).catch(() => undefined).finally(() => setReady(true)); }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(storageKey, JSON.stringify(states)).catch(() => undefined); }, [ready, states]);
  const reviewed = items.filter(item => states[item.id] && states[item.id] !== 'unreviewed').length;
  const attention = items.filter(item => states[item.id] === 'attention').length;
  const cycle = (id: string) => setStates(previous => ({ ...previous, [id]: previous[id] === 'reviewed' ? 'attention' : previous[id] === 'attention' ? 'unreviewed' : 'reviewed' }));
  return <View>
    <SectionHeading title="Guided phone-hardening review" subtitle={`${reviewed}/${items.length} reviewed · ${attention} marked for attention`}/>
    <Txt size={11} color={t.muted} style={{ marginBottom: 8 }}>Tap each item to cycle through Not reviewed → Reviewed → Needs attention. These are your own checklist notes; IPward does not claim to read the setting.</Txt>
    {items.map((item, index) => {
      const state = states[item.id] ?? 'unreviewed';
      const color = state === 'reviewed' ? t.cyan : state === 'attention' ? t.amber : t.muted;
      return <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ checked: state === 'reviewed' }} accessibilityLabel={`${item.title}. ${state}. Tap to change.`} onPress={() => cycle(item.id)} style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14, borderTopWidth: index ? 1 : 0, borderColor: t.border, opacity: pressed ? .65 : 1 })}><View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: t.elevated }}><Icon name={item.icon} color={color}/></View><View style={{ flex: 1 }}><Txt size={13} weight="600">{item.title}</Txt><Txt size={10} color={t.muted} style={{ marginTop: 3 }}>{item.detail}</Txt></View><View style={{ minWidth: 82, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: color, alignItems: 'center' }}><Txt size={9} color={color} weight="700">{state === 'reviewed' ? 'REVIEWED' : state === 'attention' ? 'ATTENTION' : 'NOT REVIEWED'}</Txt></View></Pressable>;
    })}
    {!!Object.keys(states).length && <View style={{ alignSelf: 'flex-start', marginTop: 10 }}><Button small label="Reset checklist" icon="rotate-ccw" variant="ghost" onPress={() => setStates({})}/></View>}
    <InfoNote>A self-review cannot detect jailbreak/root status, hidden profiles, malicious certificates, or spyware. Use official system screens and qualified incident response when something is unfamiliar or a targeted compromise is suspected.</InfoNote>
  </View>;
}
