import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';
import { Button, Card, Icon, InfoNote, SectionHeading, Txt } from './ui';
import { comparePerformanceRun, PerformanceRun, runPerformanceProbe } from '../services/performanceProbe';
import { useTheme } from '../theme';

const preparation = [
  { title: 'Phone feels cool', detail: 'No recent overheating or heavy gaming' },
  { title: 'No large update or download', detail: 'Let installs, backups and syncing finish first' },
  { title: 'Power saving is off', detail: 'Check your device’s battery settings' },
];

function Measure({ label, value, caption }: { label: string; value: string; caption: string }) {
  const t = useTheme();
  return <View style={{ flexGrow: 1, flexBasis: 115, padding: 13, borderRadius: 14, backgroundColor: t.elevated, borderColor: t.border, borderWidth: 1 }}>
    <Txt size={10} weight="700" color={t.muted}>{label.toUpperCase()}</Txt>
    <Txt size={23} weight="600" style={{ marginTop: 4, fontVariant: ['tabular-nums'] }}>{value}</Txt>
    <Txt size={10} color={t.muted} style={{ marginTop: 3 }}>{caption}</Txt>
  </View>;
}

export function PerformanceCheck({ history, ready, onSave, onClear }: {
  history: readonly PerformanceRun[];
  ready: boolean;
  onSave: (run: PerformanceRun) => void;
  onClear: () => void;
}) {
  const t = useTheme();
  const mounted = useRef(true);
  const [conditions, setConditions] = useState([false, false, false]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const latest = history[0] ?? null;
  const comparison = useMemo(() => latest ? comparePerformanceRun(latest, history) : null, [latest, history]);
  const maxTimer = Math.max(20, ...history.slice(0, 6).map(run => run.timerP95Ms));

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function start() {
    setRunning(true); setProgress(0); setError('');
    let interrupted = false;
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') interrupted = true; });
    try {
      const run = await runPerformanceProbe(
        Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
        typeof __DEV__ !== 'undefined' && __DEV__,
        conditions.every(Boolean),
        () => mounted.current && !interrupted && AppState.currentState !== 'background' && AppState.currentState !== 'inactive'
          && (Platform.OS !== 'web' || typeof document === 'undefined' || document.visibilityState === 'visible'),
        value => { if (mounted.current) setProgress(value); },
      );
      if (mounted.current) onSave(run);
    } catch (caught) {
      if (mounted.current) setError(caught instanceof Error ? caught.message : 'The timing check could not finish.');
    } finally {
      subscription.remove();
      if (mounted.current) setRunning(false);
    }
  }

  const resultColor = comparison?.state === 'slower' ? t.amber : comparison?.state === 'mixed' ? t.purple : comparison?.state === 'usual' ? t.cyan : t.muted;

  return <View style={{ gap: 18 }}>
    <Card style={{ borderColor: t.purple, backgroundColor: t.purpleTint }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 13 }}><View style={{ width: 43, height: 43, borderRadius: 14, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="clock" size={21} color={t.purple}/></View><View style={{ flex: 1 }}><Txt size={10} weight="700" color={t.purple} style={{ letterSpacing: 1.5 }}>PERFORMANCE CLUES</Txt><Txt size={19} weight="600" style={{ marginTop: 3 }}>Is this phone slower than usual?</Txt><Txt size={12} color={t.muted} style={{ marginTop: 5, lineHeight: 19 }}>Run a short check inside IPward. Compare repeat runs made on the same phone under similar conditions.</Txt></View></View>
      <InfoNote>Slowness cannot detect Pegasus or identify what caused a delay. This check times IPward’s JavaScript, not other apps, the operating system or background processes.</InfoNote>
    </Card>

    <Card>
      <SectionHeading title="Prepare a fair check" subtitle="Tap each item you have checked. You can still run without them, but that result will not join your baseline."/>
      {preparation.map((item, index) => <Pressable key={item.title} accessibilityRole="checkbox" accessibilityState={{ checked: conditions[index] }} onPress={() => setConditions(previous => previous.map((value, position) => position === index ? !value : value))} style={({ pressed }) => ({ minHeight: 60, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: t.border, opacity: pressed ? 0.75 : 1 })}>
        <View style={{ width: 23, height: 23, borderRadius: 7, borderWidth: 1, borderColor: conditions[index] ? t.blue : t.border, backgroundColor: conditions[index] ? t.blue : t.elevated, alignItems: 'center', justifyContent: 'center' }}>{conditions[index] && <Icon name="check" size={15} color={t.light ? '#FFFFFF' : '#071B0D'}/>}</View>
        <View style={{ flex: 1 }}><Txt size={12} weight="600">{item.title}</Txt><Txt size={11} color={t.muted}>{item.detail}</Txt></View>
      </Pressable>)}
      <View style={{ marginTop: 16, alignSelf: 'flex-start' }}><Button label={running ? `Checking… ${Math.round(progress * 100)}%` : 'Run timing check'} icon="play" onPress={() => { void start(); }} disabled={running || !ready}/></View>
      <Txt size={11} color={t.muted} style={{ marginTop: 12 }}>Keep this screen open for about two seconds. The check makes no network request and uses a small local workload.</Txt>
      {running && <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={{ height: 6, borderRadius: 3, backgroundColor: t.elevated, marginTop: 10 }}><View style={{ width: `${Math.round(progress * 100)}%`, height: 6, borderRadius: 3, backgroundColor: t.purple }}/></View>}
      {!!error && <Txt accessibilityRole="alert" size={11} color={t.red} style={{ marginTop: 10 }}>{error}</Txt>}
    </Card>

    <Card>
      <SectionHeading title="Latest result" subtitle={latest ? new Date(latest.recordedAt).toLocaleString() : 'Run the check to create your first result'}/>
      {latest && comparison ? <>
        <View style={{ borderLeftWidth: 3, borderLeftColor: resultColor, paddingLeft: 13, marginBottom: 16 }}><Txt size={15} weight="700" color={resultColor}>{comparison.title}</Txt><Txt size={12} color={t.muted} style={{ marginTop: 6, lineHeight: 18 }}>{comparison.detail}</Txt></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          <Measure label="Timer delay" value={`${latest.timerP95Ms.toFixed(1)} ms`} caption="Near-worst of 12 callbacks"/>
          <Measure label="Delayed callbacks" value={`${latest.lateFramePercent.toFixed(0)}%`} caption="Frame callbacks spaced over 34 ms"/>
          <Measure label="Small task" value={`${latest.workMedianMs.toFixed(1)} ms`} caption="Median local calculation"/>
        </View>
        {comparison.baselineTimerP95Ms !== null && <Txt size={11} color={t.muted} style={{ marginTop: 13 }}>Your recent baseline: timer delay {comparison.baselineTimerP95Ms.toFixed(1)} ms · small task {comparison.baselineWorkMedianMs?.toFixed(1)} ms · {comparison.baselineCount} previous runs.</Txt>}
      </> : <Txt size={12} color={t.muted}>No performance runs are saved yet. Your first calm-condition runs establish what is usual for this phone.</Txt>}
    </Card>

    {!!history.length && <Card>
      <SectionHeading title="Your timing history" subtitle="Latest six runs · timer delay at the 95th percentile"/>
      {history.slice(0, 6).map(run => <View key={run.id} style={{ paddingVertical: 8, gap: 5 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><Txt size={11} color={t.muted}>{new Date(run.recordedAt).toLocaleString()}{run.controlled ? '' : ' · conditions unchecked'}</Txt><Txt size={11} weight="700">{run.timerP95Ms.toFixed(1)} ms</Txt></View><View style={{ height: 7, borderRadius: 4, backgroundColor: t.elevated }}><View style={{ width: `${Math.max(3, Math.min(100, 100 * run.timerP95Ms / maxTimer))}%`, height: 7, borderRadius: 4, backgroundColor: run.id === latest?.id ? t.purple : t.cyan }}/></View></View>)}
      <View style={{ marginTop: 13, alignSelf: 'flex-start' }}>{confirmClear ? <View style={{ gap: 9 }}><Txt size={11} color={t.muted}>Remove all saved timing runs from this device?</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button label="Remove history" icon="trash-2" variant="danger" onPress={() => { onClear(); setConfirmClear(false); }}/><Button label="Cancel" variant="ghost" onPress={() => setConfirmClear(false)}/></View></View> : <Button label="Clear timing history" icon="trash-2" variant="ghost" onPress={() => setConfirmClear(true)}/>}</View>
    </Card>}

    <Card>
      <SectionHeading title="What to do with a slower result" subtitle="Repeat first, then look for ordinary causes and independent evidence"/>
      <View style={{ gap: 10 }}>
        {['Repeat on another day with the phone cool and no large downloads or updates.', 'Check battery health, free storage, power saving and OS updates in device settings.', 'If you also have an independent indicator match or a strong reason to suspect targeted spyware, preserve evidence and use the Deep forensic guide.'].map((item, index) => <View key={item} style={{ flexDirection: 'row', gap: 11, padding: 12, borderRadius: 12, backgroundColor: t.elevated }}><Txt size={11} weight="700" color={t.purple}>{index + 1}</Txt><Txt size={12} style={{ flex: 1, lineHeight: 18 }}>{item}</Txt></View>)}
      </View><InfoNote>Close-to-usual timing does not mean the phone is free of spyware. A slower result does not mean spyware was found.</InfoNote>
    </Card>
  </View>;
}
