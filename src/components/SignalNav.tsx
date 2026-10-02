import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Route, useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { Icon, IconName, Txt } from './ui';

const destinations: { route: Route; icon: IconName }[] = [
  { route: 'Overview', icon: 'home' },
  { route: 'Activity', icon: 'activity' },
  { route: 'Apps', icon: 'grid' },
  { route: 'Connections', icon: 'git-branch' },
  { route: 'Protect', icon: 'shield' },
];

function SignalTab({ route, icon }: (typeof destinations)[number]) {
  const { route: current, navigate, settings } = useApp();
  const t = useTheme();
  const active = current === route;
  const [selection] = useState(() => new Animated.Value(active ? 1 : 0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (settings.reducedMotion) { selection.setValue(active ? 1 : 0); return; }
    Animated.spring(selection, { toValue: active ? 1 : 0, speed: 20, bounciness: 9, useNativeDriver: true }).start();
  }, [active, selection, settings.reducedMotion]);
  useEffect(() => {
    if (!active || settings.reducedMotion) { pulse.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [active, pulse, settings.reducedMotion]);

  return <Pressable accessibilityRole="button" accessibilityLabel={route} accessibilityState={{ selected: active }} onPress={() => navigate(route)} style={{ flex: 1, minWidth: 0, height: 71, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, width: 45, height: 45, borderRadius: 22, borderWidth: 1, borderColor: t.blue, opacity: Animated.multiply(selection, pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.42] })), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.2] }) }] }}/>
    <Animated.View style={{ width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 6, borderBottomRightRadius: 16, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: active ? t.blue : 'transparent', backgroundColor: active ? t.blueTint : 'transparent', shadowColor: t.blue, shadowOpacity: active && !t.light ? 0.55 : 0, shadowRadius: 10, transform: [{ translateY: selection.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }, { scale: selection.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] }) }] }}>
      <Icon name={icon} size={18} color={active ? t.blue : t.muted}/>
    </Animated.View>
    <Txt numberOfLines={1} size={9} color={active ? t.blue : t.muted} weight={active ? '700' : '500'} style={{ marginTop: 2 }}>{route}</Txt>
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -3, width: 34, height: 2, borderRadius: 2, backgroundColor: t.blue, opacity: selection, transform: [{ scaleX: selection }] }}/>
  </Pressable>;
}

export function SignalNav({ bottomInset }: { bottomInset: number }) {
  const t = useTheme();
  return <View style={{ height: 91 + bottomInset, paddingBottom: Math.max(bottomInset, 5), paddingHorizontal: 10, justifyContent: 'flex-end', backgroundColor: t.background }}>
    <View pointerEvents="none" style={{ position: 'absolute', left: 10, right: 10, bottom: Math.max(bottomInset, 5) + 5, height: 73, borderTopLeftRadius: 25, borderTopRightRadius: 11, borderBottomRightRadius: 25, borderBottomLeftRadius: 11, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, overflow: 'hidden', shadowColor: '#000', shadowOpacity: t.light ? 0.13 : 0.4, shadowRadius: 16, elevation: 5 }}>
      <LinearGradient colors={t.light ? ['#FFFFFF', '#E2E8E8'] : ['#354149', '#192027']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}/>
      <View style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 1, backgroundColor: t.cyan, opacity: 0.5 }}/>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}><Path d="M0 49 H18 M305 22 H330" stroke={t.blue} strokeWidth="1" opacity="0.55"/></Svg>
    </View>
    <View style={{ height: 75, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 3 }}>{destinations.map(item => <SignalTab key={item.route} {...item}/>)}</View>
  </View>;
}
