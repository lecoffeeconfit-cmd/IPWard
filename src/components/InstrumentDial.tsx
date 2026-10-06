import React, { memo, useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme';
import { Icon, Txt } from './ui';

interface InstrumentDialProps {
  value: string | number;
  label: string;
  size?: number;
  active?: boolean;
  reducedMotion?: boolean;
  onPress?: () => void;
}

/** The rings are decorative. Only the centered value is a measured count. */
export const InstrumentDial = memo(function InstrumentDial({ value, label, size = 222, active = true, reducedMotion = false, onPress }: InstrumentDialProps) {
  const t = useTheme();
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const [systemReduced, setSystemReduced] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `dialFace${id}`;
  const motion = active && !reducedMotion && !systemReduced && foreground;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setSystemReduced(value); }).catch(() => { /* Keep the dial still if the setting cannot be read. */ });
    const reduce = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduced);
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => { mounted = false; reduce.remove(); app.remove(); };
  }, []);
  useEffect(() => {
    if (!motion) { spin.stopAnimation(); breathe.stopAnimation(); spin.setValue(0); breathe.setValue(0); return; }
    const orbit = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web', isInteraction: false }));
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(breathe, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]));
    orbit.start(); pulse.start();
    return () => { orbit.stop(); pulse.stop(); };
  }, [motion, spin, breathe]);

  const ticks = Array.from({ length: 40 }, (_, index) => {
    const angle = (index * 9 - 90) * Math.PI / 180;
    const major = index % 5 === 0;
    const inner = major ? 101 : 105;
    return { x1: 120 + Math.cos(angle) * inner, y1: 120 + Math.sin(angle) * inner, x2: 120 + Math.cos(angle) * 111, y2: 120 + Math.sin(angle) * 111, major };
  });
  const face = <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={size} height={size} viewBox="0 0 240 240" style={StyleSheet.absoluteFill}>
      <Defs><RadialGradient id={gradientId} cx="42%" cy="35%" rx="70%" ry="70%"><Stop offset="0%" stopColor={t.light ? '#FFFFFF' : '#4A555B'}/><Stop offset="56%" stopColor={t.light ? '#E4E8E6' : '#263039'}/><Stop offset="100%" stopColor={t.light ? '#B9C5C6' : '#11191F'}/></RadialGradient></Defs>
      <Circle cx="120" cy="120" r="115" fill={t.light ? '#C7D0CF' : '#10171D'} stroke={t.border} strokeWidth="2"/>
      <Circle cx="120" cy="120" r="99" fill="none" stroke={t.light ? '#F9FCFA' : '#42515A'} strokeWidth="1.2"/>
      {ticks.map((tick, index) => <Line key={index} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} stroke={index < 9 ? t.blue : t.subtle} strokeWidth={tick.major ? 1.8 : 0.8} opacity={tick.major ? 0.82 : 0.48}/>)}
      <Circle cx="120" cy="120" r="86" fill={`url(#${gradientId})`} stroke={t.light ? '#F5F8F5' : '#43515A'} strokeWidth="2"/>
      <Circle cx="120" cy="120" r="77" fill="none" stroke={t.light ? '#9AA9A8' : '#11171D'} strokeWidth="9" opacity="0.45"/>
      <Circle cx="120" cy="120" r="69" fill="none" stroke={t.light ? '#CBD4D1' : '#57646A'} strokeWidth="1" opacity="0.9"/>
    </Svg>
    <Animated.View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
      <Svg width={size} height={size} viewBox="0 0 240 240"><Circle cx="120" cy="120" r="94" fill="none" stroke={t.blue} strokeWidth="4" strokeLinecap="round" strokeDasharray="92 500" transform="rotate(-90 120 120)"/><Circle cx="120" cy="26" r="4" fill={t.blue}/></Svg>
    </Animated.View>
    <Animated.View style={{ pointerEvents: 'none', alignItems: 'center', opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }), transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) }] }}>
      <View style={{ width: size < 205 ? 49 : 56, height: size < 205 ? 49 : 56, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="wifi" size={size < 205 ? 38 : 44} color={t.blue}/>
      </View>
      <Txt size={size < 205 ? 29 : 34} weight="600" color={t.blue} style={{ marginTop: 1, lineHeight: size < 205 ? 32 : 37, letterSpacing: -1.5, fontVariant: ['tabular-nums'] }}>{value}</Txt>
      <Txt size={size < 205 ? 8 : 9} color={t.muted} weight="700" style={{ letterSpacing: 1.45, lineHeight: 12, textAlign: 'center' }}>{label.toUpperCase()}</Txt>
    </Animated.View>
  </View>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${value} ${label}. Open details.`} onPress={onPress}>{face}</Pressable> : <View accessible accessibilityRole="text" accessibilityLabel={`${value} ${label}`}>{face}</View>;
});
