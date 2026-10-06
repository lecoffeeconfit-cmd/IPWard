import React, { memo, useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export interface NetworkCoreProps {
  size?: number;
  active?: boolean;
  reducedMotion?: boolean;
  light?: boolean;
}

const satellites = [
  { x: 82, y: 79, radius: 3.3, cyan: false },
  { x: 269, y: 132, radius: 3.8, cyan: true },
  { x: 205, y: 263, radius: 3.2, cyan: false },
  { x: 48, y: 185, radius: 2.5, cyan: false },
  { x: 224, y: 73, radius: 2, cyan: true },
  { x: 111, y: 239, radius: 2, cyan: true },
];

/** An abstract activity illustration. It never encodes unmeasured live metrics. */
export const NetworkCore = memo(function NetworkCore({
  size = 260,
  active = true,
  reducedMotion = false,
  light = false,
}: NetworkCoreProps) {
  const rotation = useRef(new Animated.Value(0)).current;
  const [systemReducedMotion, setSystemReducedMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const uniqueId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const haloId = `coreHalo${uniqueId}`;
  const phoneId = `phoneHalo${uniqueId}`;
  const blue = light ? '#007A2B' : '#00FF41';
  const cyan = light ? '#187D83' : '#70DCE0';
  const muted = light ? '#A8B8B7' : '#4B6065';

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(value => { if (mounted) setSystemReducedMotion(value); })
      .catch(() => { /* Keep the static illustration if the preference is unavailable. */ });
    const motionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReducedMotion);
    const appSubscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => {
      mounted = false;
      motionSubscription.remove();
      appSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!active || reducedMotion || systemReducedMotion || !foreground || Platform.OS === 'web') {
      rotation.stopAnimation();
      return;
    }
    rotation.setValue(0);
    const loop = Animated.loop(Animated.timing(rotation, {
      toValue: 1,
      duration: 84000,
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    }));
    loop.start();
    return () => loop.stop();
  }, [active, foreground, reducedMotion, rotation, systemReducedMotion]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={active ? 'Network core. Abstract visualization of device connections.' : 'Network core paused.'}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 320 320" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={haloId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={blue} stopOpacity={light ? 0.16 : 0.15} />
            <Stop offset="48%" stopColor={blue} stopOpacity={light ? 0.08 : 0.06} />
            <Stop offset="100%" stopColor={blue} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="160" cy="160" r="158" fill={`url(#${haloId})`} />
        <Circle cx="160" cy="160" r="119" fill="none" stroke={muted} strokeWidth="0.8" opacity="0.46" />
        <Circle cx="160" cy="160" r="143" fill="none" stroke={muted} strokeWidth="0.7" strokeDasharray="1 8" opacity="0.6" />
        <Circle cx="160" cy="160" r="89" fill="none" stroke={blue} strokeWidth="0.6" opacity="0.1" />
        <Path d="M160 9V17 M160 303V311 M9 160H17 M303 160H311" stroke={muted} strokeWidth="1" opacity="0.7" />
      </Svg>
      <Animated.View
        style={[StyleSheet.absoluteFill, {
          pointerEvents: 'none',
          opacity: active ? 1 : 0.42,
          transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        }]}
      >
        <Svg width={size} height={size} viewBox="0 0 320 320">
          <G fill="none">
            <Ellipse cx="160" cy="160" rx="119" ry="60" transform="rotate(-31 160 160)" stroke={blue} strokeWidth="0.9" opacity="0.42" />
            <Ellipse cx="160" cy="160" rx="119" ry="60" transform="rotate(39 160 160)" stroke={cyan} strokeWidth="0.8" opacity="0.22" />
            <Ellipse cx="160" cy="160" rx="119" ry="60" transform="rotate(101 160 160)" stroke={blue} strokeWidth="0.8" opacity="0.21" />
            <Ellipse cx="160" cy="160" rx="107" ry="104" transform="rotate(-15 160 160)" stroke={blue} strokeWidth="0.8" strokeDasharray="2 9" opacity="0.32" />
            <Path d="M82 79 Q102 106 135 131 M269 132 Q228 146 186 153 M205 263 Q186 218 171 192" stroke={blue} strokeWidth="0.75" strokeDasharray="2 5" opacity="0.38" />
          </G>
          {satellites.map(({ x, y, radius, cyan: isCyan }, index) => (
            <G key={index}>
              <Circle cx={x} cy={y} r={radius * 3.6} fill={isCyan ? cyan : blue} opacity="0.055" />
              <Circle cx={x} cy={y} r={radius * 1.9} fill={isCyan ? cyan : blue} opacity="0.11" />
              <Circle cx={x} cy={y} r={radius} fill={isCyan ? cyan : blue} opacity="0.95" />
            </G>
          ))}
          <Circle cx="71" cy="130" r="1.5" fill={blue} opacity="0.6" />
          <Circle cx="197" cy="49" r="1.5" fill={blue} opacity="0.45" />
          <Circle cx="274" cy="198" r="1.5" fill={cyan} opacity="0.5" />
          <Circle cx="145" cy="278" r="1.5" fill={blue} opacity="0.6" />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} viewBox="0 0 320 320" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={phoneId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={blue} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={blue} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="160" cy="160" r="71" fill={`url(#${phoneId})`} />
        <Circle cx="160" cy="160" r="48" fill={light ? '#E8ECE9' : '#1C262B'} stroke={blue} strokeWidth="0.75" strokeOpacity="0.22" />
        <Circle cx="160" cy="160" r="42" fill="none" stroke={blue} strokeWidth="0.5" opacity="0.11" />
        <Rect x="143" y="132" width="34" height="56" rx="8" stroke={light ? '#007A2B' : '#8DFFAE'} strokeWidth="1.8" fill={light ? '#F4F6F2' : '#263036'} />
        <Line x1="155" y1="138" x2="165" y2="138" stroke={blue} strokeWidth="1.8" strokeLinecap="round" />
        <Line x1="154" y1="181" x2="166" y2="181" stroke={blue} strokeWidth="1.7" strokeLinecap="round" />
        <Circle cx="160" cy="158" r="6" stroke={cyan} strokeWidth="1.1" fill="none" opacity={active ? 0.9 : 0.4} />
        <Circle cx="160" cy="158" r="2" fill={cyan} opacity={active ? 1 : 0.4} />
      </Svg>
    </View>
  );
});

export default NetworkCore;
