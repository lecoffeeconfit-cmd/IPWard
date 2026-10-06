import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Pressable, View } from 'react-native';
import type { NetworkState } from 'expo-network';
import { Button, Card, Icon, InfoNote, SectionHeading, Txt } from './ui';
import { CONNECTION_TEST_SIZES, ConnectionLink, ConnectionTestResult, ConnectionTestSize, runConnectionTest } from '../services/connectionTest';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';

function linkName(link: ConnectionLink): string {
  switch (link) {
    case 'WIFI': return 'Wi-Fi';
    case 'CELLULAR': return 'Mobile data';
    case 'BLUETOOTH': return 'Bluetooth tethering';
    case 'VPN': return 'VPN route';
    case 'ETHERNET': return 'Ethernet';
    case 'NONE': return 'No active connection';
    case 'OTHER': return 'Other connection';
    default: return 'Unknown connection';
  }
}
function asLink(value: NetworkState['type']): ConnectionLink {
  return value === 'WIFI' || value === 'CELLULAR' || value === 'BLUETOOTH' || value === 'VPN' || value === 'ETHERNET' || value === 'NONE' || value === 'OTHER' ? value : 'UNKNOWN';
}
function number(value: number, unit: string) { return `${value.toFixed(1)} ${unit}`; }

function Reading({ icon, label, value, detail }: { icon: 'arrow-down' | 'arrow-up' | 'clock' | 'activity'; label: string; value: string; detail: string }) {
  const t = useTheme();
  return <View style={{ flexGrow: 1, flexBasis: 128, minWidth: 128, borderColor: t.border, borderWidth: 1, borderRadius: 14, backgroundColor: t.elevated, padding: 14 }}>
    <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}><Icon name={icon} size={14} color={t.cyan}/><Txt size={10} weight="700" color={t.muted}>{label.toUpperCase()}</Txt></View>
    <Txt size={22} weight="600" style={{ marginTop: 7, fontVariant: ['tabular-nums'] }}>{value}</Txt>
    <Txt size={10} color={t.muted} style={{ marginTop: 3 }}>{detail}</Txt>
  </View>;
}

export function ConnectionDiagnostics({ history, ready, onSave, onClear }: {
  history: readonly ConnectionTestResult[];
  ready: boolean;
  onSave: (result: ConnectionTestResult) => void;
  onClear: () => void;
}) {
  const t = useTheme();
  const { settings } = useApp();
  const [networkState, setNetworkState] = useState<NetworkState | null>(null);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [networkModule, setNetworkModule] = useState<typeof import('expo-network') | null>(null);
  const [networkError, setNetworkError] = useState('');
  const [size, setSize] = useState<ConnectionTestSize>('quick');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [testError, setTestError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [safetyReview, setSafetyReview] = useState<Record<string, boolean>>({});
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const stopReason = useRef<'cancelled' | 'timeout' | 'interrupted' | null>(null);
  const [pulse] = useState(() => new Animated.Value(0));
  const latest = history[0] ?? null;
  const link = asLink(networkState?.type);
  const maxDownload = Math.max(1, ...history.slice(0, 5).map(item => item.downloadMbps));

  useEffect(() => {
    mounted.current = true;
    let subscription: { remove: () => void } | null = null;
    void import('expo-network').then(module => {
      if (!mounted.current) return;
      setNetworkModule(module);
      void module.getNetworkStateAsync().then(state => { if (mounted.current) { setNetworkState(state); setNetworkError(''); } }).catch(() => { if (mounted.current) setNetworkError('Connection type is unavailable in this build. The internet test can still run.'); });
      void module.getIpAddressAsync().then(address => { if (mounted.current) setIpAddress(address); }).catch(() => { if (mounted.current) setIpAddress(null); });
      try { subscription = module.addNetworkStateListener(state => { if (mounted.current) setNetworkState(state); }); }
      catch { /* A new development build may be needed after adding expo-network. */ }
    }).catch(() => { if (mounted.current) setNetworkError('Connection type needs a new development build. The internet test can still run.'); });
    return () => { mounted.current = false; subscription?.remove(); controller.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!running || settings.reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 850, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [running, settings.reducedMotion, pulse]);

  async function refreshConnection() {
    try { const module = networkModule ?? await import('expo-network'); const [state, address] = await Promise.all([module.getNetworkStateAsync(), module.getIpAddressAsync().catch(() => null)]); setNetworkState(state); setIpAddress(address); setNetworkModule(module); setNetworkError(''); }
    catch { setNetworkError('Connection type could not be read on this device.'); }
  }
  async function start() {
    setRunning(true); setProgress(0); setTestError(''); stopReason.current = null;
    const activeController = new AbortController();
    controller.current = activeController;
    const timeout = setTimeout(() => { stopReason.current = 'timeout'; activeController.abort(); }, 20_000);
    const appSubscription = AppState.addEventListener('change', state => { if (state !== 'active') { stopReason.current = 'interrupted'; activeController.abort(); } });
    try {
      let before: NetworkState | null = null;
      try { const module = networkModule ?? await import('expo-network'); before = await module.getNetworkStateAsync(); if (mounted.current) { setNetworkState(before); setNetworkModule(module); } } catch { /* Internet request below is the direct reachability check. */ }
      if (before?.type === 'NONE') throw new Error('Connect to Wi-Fi or mobile data before testing.');
      const startLink = asLink(before?.type);
      const result = await runConnectionTest(size, startLink, activeController.signal, value => { if (mounted.current) setProgress(value); });
      let after: NetworkState | null = null;
      try { const module = networkModule ?? await import('expo-network'); after = await module.getNetworkStateAsync(); if (mounted.current) setNetworkState(after); } catch { /* Keep the result with an unknown or last-known route. */ }
      if (activeController.signal.aborted) throw new Error('The connection test was cancelled.');
      if (after && before && asLink(after.type) !== startLink) throw new Error('The active connection changed during the test. Run it again on one connection.');
      if (mounted.current) onSave(result);
    } catch (caught) {
      if (mounted.current) setTestError(stopReason.current === 'cancelled' ? 'Test stopped. Some data may already have transferred.' : stopReason.current === 'timeout' ? 'The test timed out after 20 seconds. Try the smaller test or another connection.' : stopReason.current === 'interrupted' ? 'The test stopped when IPward left the foreground.' : caught instanceof Error ? caught.message : 'The test could not finish.');
    } finally {
      clearTimeout(timeout); appSubscription.remove(); controller.current = null;
      if (mounted.current) setRunning(false);
    }
  }
  function stop() { stopReason.current = 'cancelled'; controller.current?.abort(); }

  const stage = progress < 0.36 ? 'Checking response time' : progress < 0.72 ? 'Downloading test data' : 'Uploading test data';
  const selected = CONNECTION_TEST_SIZES[size];
  const offline = link === 'NONE';
  const reachability = networkState?.isInternetReachable === false && link !== 'UNKNOWN' ? 'Internet not confirmed' : networkState?.isInternetReachable === true ? 'Internet reported available' : 'Internet status unknown';
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.22] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0.12] });

  return <View style={{ gap: 18 }}>
    <Card style={{ borderColor: t.cyan, backgroundColor: t.cyanTint }}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View style={{ width: 58, height: 58, alignItems: 'center', justifyContent: 'center' }}>
          {running && !settings.reducedMotion && <Animated.View style={{ position: 'absolute', width: 53, height: 53, borderRadius: 27, borderWidth: 2, borderColor: t.cyan, transform: [{ scale: ringScale }], opacity: ringOpacity }}/ >}
          <View style={{ width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface }}><Icon name="wifi" size={22} color={t.cyan}/></View>
        </View>
        <View style={{ flex: 1 }}><Txt size={10} color={t.cyan} weight="700" style={{ letterSpacing: 1.5 }}>CONNECTION DIAGNOSTICS</Txt><Txt size={19} weight="600" style={{ marginTop: 3 }}>Internet, Wi-Fi & Bluetooth</Txt><Txt size={12} color={t.muted} style={{ marginTop: 4, lineHeight: 18 }}>See the active route and test its internet response, download and upload speeds.</Txt></View>
      </View>
      <InfoNote>This measures the internet path to one Cloudflare test server. It is not your Wi-Fi radio link speed, a complete data-usage meter, or a Bluetooth device-to-device speed test.</InfoNote>
    </Card>

    <Card>
      <SectionHeading title="Current connection" subtitle="Reported by this device, with no speed-test traffic" action="Refresh" onAction={() => { void refreshConnection(); }}/>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border }}><View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: t.cyanTint, alignItems: 'center', justifyContent: 'center' }}><Icon name={link === 'BLUETOOTH' ? 'bluetooth' : link === 'CELLULAR' ? 'radio' : 'wifi'} color={t.cyan} size={19}/></View><View style={{ flex: 1 }}><Txt size={14} weight="700">{linkName(link)}</Txt><Txt size={11} color={t.muted}>{reachability}</Txt></View><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: offline ? t.muted : t.cyan }}/></View>
      {!!ipAddress && <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 11, paddingHorizontal: 4 }}><Txt size={11} color={t.muted}>Current local IP</Txt><Txt selectable size={11} weight="600">{ipAddress}</Txt></View>}
      {!!networkError && <Txt size={11} color={t.amber} style={{ marginTop: 10 }}>{networkError}</Txt>}
      <Txt size={11} color={t.muted} style={{ marginTop: 12 }}>A VPN can hide the underlying Wi-Fi or mobile route. Browser previews may only report “unknown.” IPward reads the current local IP only for this screen and does not save it in test history. Wi-Fi names and passwords remain unavailable.</Txt>
    </Card>

    <Card>
      <SectionHeading title="Local network safety review" subtitle="A quick checklist for the connection you are using now"/>
      {[
        ['expected', 'This is the network or hotspot I intended to join.', 'Unexpected networks can imitate familiar names.'],
        ['portal', 'Any captive-portal sign-in is complete and expected.', 'Avoid entering sensitive data into a surprising sign-in page.'],
        ['vpn', 'Every active VPN or custom DNS setting is familiar.', 'Unknown VPN or DNS configuration can redirect traffic.'],
        ['router', 'If I own the router, its firmware and admin password are current.', 'Router details cannot be inspected from this app sandbox.'],
      ].map(([id, title, detail], index) => <Pressable key={id} accessibilityRole="checkbox" accessibilityState={{ checked: !!safetyReview[id] }} onPress={() => setSafetyReview(previous => ({ ...previous, [id]: !previous[id] }))} style={({ pressed }) => ({ flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 13, borderTopWidth: index ? 1 : 0, borderColor: t.border, opacity: pressed ? .65 : 1 })}><View style={{ width: 27, height: 27, borderRadius: 9, borderWidth: 1, borderColor: safetyReview[id] ? t.cyan : t.border, backgroundColor: safetyReview[id] ? t.cyanTint : t.elevated, alignItems: 'center', justifyContent: 'center' }}>{safetyReview[id] && <Icon name="check" color={t.cyan} size={15}/>}</View><View style={{ flex: 1 }}><Txt size={12} weight="600">{title}</Txt><Txt size={10} color={t.muted}>{detail}</Txt></View></Pressable>)}
      <InfoNote>IPward cannot enumerate nearby devices, read router encryption, detect ARP poisoning, or prove a rogue access point is absent with the APIs connected in this build.</InfoNote>
    </Card>

    <Card>
      <SectionHeading title="Test internet speed" subtitle="Choose how much data to use, then start the test"/>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        {([['quick', 'Quick check', 'About 350 KB'], ['standard', 'Deeper check', 'About 3 MB']] as const).map(([value, title, detail]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: size === value }} onPress={() => setSize(value)} disabled={running} style={({ pressed }) => ({ flexGrow: 1, flexBasis: 135, minHeight: 68, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: size === value ? t.cyan : t.border, backgroundColor: size === value ? t.cyanTint : t.elevated, opacity: pressed ? 0.75 : 1 })}><Txt size={12} weight="700" color={size === value ? t.cyan : t.text}>{title}</Txt><Txt size={11} color={t.muted} style={{ marginTop: 3 }}>{detail} plus connection overhead</Txt></Pressable>)}
      </View>
      <Txt size={11} color={t.muted} style={{ marginTop: 13, lineHeight: 18 }}>Starting sends three small requests, downloads {Math.round(selected.download / 1000)} KB and uploads {Math.round(selected.upload / 1000)} KB to Cloudflare. Cloudflare can see your IP address and may collect speed-test results. IPward does not upload your activity history.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 16 }}><Button label={running ? stage : 'Start speed test'} icon={running ? 'activity' : 'play'} onPress={() => { void start(); }} disabled={running || !ready || offline}/>{running && <Button label="Stop" icon="x" variant="secondary" onPress={stop}/>}</View>
      {running && <View style={{ marginTop: 15, height: 7, borderRadius: 4, backgroundColor: t.elevated }}><View style={{ width: `${Math.round(progress * 100)}%`, height: 7, borderRadius: 4, backgroundColor: t.cyan }}/></View>}
      {!!testError && <Txt accessibilityRole="alert" size={11} color={t.red} style={{ marginTop: 12 }}>{testError}</Txt>}
    </Card>

    <Card>
      <SectionHeading title="Latest internet result" subtitle={latest ? `${new Date(latest.recordedAt).toLocaleString()} · ${linkName(latest.link)} · ${latest.size} check` : 'Start a speed test to see your numbers'}/>
      {latest ? <><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        <Reading icon="clock" label="Response" value={number(latest.latencyMs, 'ms')} detail="Round trip to Cloudflare"/>
        <Reading icon="activity" label="Variation" value={number(latest.variationMs, 'ms')} detail="Spread across three requests"/>
        <Reading icon="arrow-down" label="Download" value={number(latest.downloadMbps, 'Mbps')} detail="Approximate internet rate"/>
        <Reading icon="arrow-up" label="Upload" value={number(latest.uploadMbps, 'Mbps')} detail="Approximate internet rate"/>
      </View><Txt size={11} color={t.muted} style={{ marginTop: 13 }}>Test payload: {((latest.downloadedBytes + latest.uploadedBytes) / 1_000_000).toFixed(2)} MB plus protocol overhead. Results vary with server load, signal, congestion and the test size.</Txt></> : <Txt size={12} color={t.muted}>The test runs only when you tap Start. Your results stay on this device unless you export the Security Center report.</Txt>}
    </Card>

    {!!history.length && <Card>
      <SectionHeading title="Recent internet checks" subtitle="Download estimates from the last five tests"/>
      {history.slice(0, 5).map(item => <View key={item.id} style={{ paddingVertical: 8, gap: 5 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><Txt size={11} color={t.muted}>{new Date(item.recordedAt).toLocaleString()} · {linkName(item.link)}</Txt><Txt size={11} weight="700">{item.downloadMbps.toFixed(1)} Mbps</Txt></View><View style={{ height: 7, borderRadius: 4, backgroundColor: t.elevated }}><View style={{ width: `${Math.max(3, 100 * item.downloadMbps / maxDownload)}%`, height: 7, borderRadius: 4, backgroundColor: item.id === latest?.id ? t.cyan : t.purple }}/></View></View>)}
      <View style={{ marginTop: 13, alignSelf: 'flex-start' }}>{confirmClear ? <View style={{ gap: 9 }}><Txt size={11} color={t.muted}>Remove saved internet test results from this device?</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button label="Remove results" icon="trash-2" variant="danger" onPress={() => { onClear(); setConfirmClear(false); }}/><Button label="Cancel" variant="ghost" onPress={() => setConfirmClear(false)}/></View></View> : <Button label="Clear internet test history" icon="trash-2" variant="ghost" onPress={() => setConfirmClear(true)}/>}</View>
    </Card>}

    <Card>
      <SectionHeading title="Understand the link" subtitle="Internet speed and local radio speed are different measurements"/>
      <View style={{ gap: 11 }}>
        <View style={{ padding: 13, backgroundColor: t.elevated, borderRadius: 12 }}><Txt size={12} weight="700">Wi-Fi</Txt><Txt size={11} color={t.muted} style={{ marginTop: 4, lineHeight: 17 }}>This test includes your router, internet provider and Cloudflare. IPward cannot read Wi-Fi signal strength, channel, router link rate or the network name from this screen.</Txt></View>
        <View style={{ padding: 13, backgroundColor: t.elevated, borderRadius: 12 }}><Txt size={12} weight="700">Mobile data</Txt><Txt size={11} color={t.muted} style={{ marginTop: 4, lineHeight: 17 }}>A speed test uses your data plan. Move to Wi-Fi or choose the smaller check if data is limited. Signal, congestion and carrier policy can change the result.</Txt></View>
        <View style={{ padding: 13, backgroundColor: t.elevated, borderRadius: 12 }}><Txt size={12} weight="700">Bluetooth</Txt><Txt size={11} color={t.muted} style={{ marginTop: 4, lineHeight: 17 }}>{link === 'BLUETOOTH' ? 'Android reports Bluetooth tethering as the active internet route, so this test measures internet through that tether. It does not measure a nearby Bluetooth device’s direct transfer speed.' : 'Direct Bluetooth transfer speed needs a paired accessory or a second device running a compatible test. IPward has no such native test partner connected, so it does not invent a Mbps figure for headphones or nearby devices.'}</Txt></View>
      </View>
    </Card>
  </View>;
}
