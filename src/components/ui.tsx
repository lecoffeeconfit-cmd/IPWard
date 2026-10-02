import React, { useState } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

export type IconName = React.ComponentProps<typeof Feather>['name'];
export function Icon({ name, size = 19, color }: { name: IconName; size?: number; color?: string }) {
  const t = useTheme();
  return <Feather name={name} size={size} color={color ?? t.muted}/>;
}
export function Txt({ children, size = 14, color, weight = '400', style, ...props }: TextProps & { size?: number; color?: string; weight?: TextStyle['fontWeight'] }) {
  const t = useTheme();
  return <Text {...props} style={[{ fontSize: size, color: color ?? t.text, fontWeight: weight, lineHeight: size * 1.45 }, style]}>{children}</Text>;
}

const panelShape = { borderTopLeftRadius: 23, borderTopRightRadius: 13, borderBottomRightRadius: 25, borderBottomLeftRadius: 13 } as const;
const controlShape = { borderTopLeftRadius: 23, borderTopRightRadius: 9, borderBottomRightRadius: 22, borderBottomLeftRadius: 9 } as const;
export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const t = useTheme();
  const base: StyleProp<ViewStyle> = [{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, padding: 22, overflow: 'hidden', ...panelShape, shadowColor: '#000', shadowOpacity: t.light ? 0.06 : 0.2, shadowRadius: 13, shadowOffset: { width: 0, height: 7 }, elevation: 3 }, style];
  const content = <>
    <LinearGradient colors={t.light ? ['rgba(255,255,255,0.82)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.07)', 'rgba(0,0,0,0.11)']} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, panelShape, { pointerEvents: 'none' }]}/>
    <View style={{ pointerEvents: 'none', position: 'absolute', top: 0, left: 20, width: 74, height: 1, backgroundColor: t.light ? '#FFFFFF' : '#64747D', opacity: t.light ? 0.95 : 0.45 }}/>
    {children}
  </>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, { borderColor: pressed ? t.blue : t.border, opacity: pressed ? 0.86 : 1 }]}>{content}</Pressable> : <View style={base}>{content}</View>;
}

export function Button({ label, onPress, icon, variant = 'primary', disabled = false, small = false }: { label: string; onPress: () => void; icon?: IconName; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; disabled?: boolean; small?: boolean }) {
  const t = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const animate = (toValue: number) => Animated.spring(scale, { toValue, speed: 24, bounciness: 9, useNativeDriver: true }).start();
  const primary = variant === 'primary';
  const foreground = primary ? '#FFFFFF' : variant === 'danger' ? t.red : t.text;
  const background = primary ? (t.light ? '#B35414' : '#D56528') : variant === 'secondary' ? t.elevated : 'transparent';
  return <Animated.View style={{ transform: [{ scale }] }}><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} onPressIn={() => animate(0.94)} onPressOut={() => animate(1)} style={({ pressed }) => ({ minHeight: small ? 40 : 49, paddingHorizontal: small ? 14 : 18, backgroundColor: background, borderWidth: 1, borderColor: primary ? (t.light ? '#A34A12' : '#FEA34C') : pressed ? t.blue : t.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, overflow: 'hidden', opacity: disabled ? 0.4 : 1, ...controlShape })}>
    {primary && <LinearGradient colors={t.light ? ['#E48739', '#A84816'] : ['#FFA34B', '#D45521']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}/>}
    <View style={{ pointerEvents: 'none', position: 'absolute', top: 1, left: 15, right: 15, height: 1, backgroundColor: primary ? '#FFE0B4' : t.light ? '#FFFFFF' : '#7C8A91', opacity: primary ? 0.55 : 0.28 }}/>
    {icon && <Icon name={icon} color={foreground} size={small ? 15 : 17}/>}
    <Txt size={small ? 11 : 12} weight="700" color={foreground} style={{ letterSpacing: 0.35 }}>{label}</Txt>
  </Pressable></Animated.View>;
}
export function IconButton({ name, onPress, label }: { name: IconName; onPress: () => void; label: string }) {
  const t = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? t.hover : t.elevated, borderWidth: 1, borderColor: pressed ? t.blue : t.border, shadowColor: '#000', shadowOpacity: t.light ? 0.08 : 0.35, shadowRadius: 7, shadowOffset: { width: 2, height: 4 } })}><Icon name={name} color={t.text} size={17}/></Pressable>;
}
export function SectionHeading({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12 }}><View style={{ flex: 1 }}><Txt size={17} weight="600" style={{ letterSpacing: -0.2 }}>{title}</Txt>{subtitle && <Txt size={12} color={t.muted} style={{ marginTop: 3 }}>{subtitle}</Txt>}</View>{action && <Pressable accessibilityRole="button" onPress={onAction} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}><Txt size={11} color={t.blue} weight="700" style={{ letterSpacing: 0.35 }}>{action}</Txt><Icon name="arrow-up-right" size={14} color={t.blue}/></Pressable>}</View>;
}
export function Badge({ state, onPress }: { state: string; onPress?: () => void }) {
  const t = useTheme();
  const key = state.toLowerCase();
  const color = key === 'confirmed' ? t.cyan : key === 'estimated' ? t.purple : key === 'observed' ? t.blue : t.muted;
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  const badgeStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, alignSelf: 'flex-start' as const, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.elevated };
  const content = <><Txt size={11} weight="700" color={color}>{key === 'confirmed' ? '✓' : key === 'estimated' ? '≈' : key === 'observed' ? '●' : '—'}</Txt><Txt size={10} color={color} weight="600">{label}</Txt></>;
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" style={badgeStyle}>{content}</Pressable> : <View style={badgeStyle}>{content}</View>;
}
export function Pill({ label, active, onPress, icon }: { label: string; active?: boolean; onPress: () => void; icon?: IconName }) {
  const t = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress} style={({ pressed }) => ({ paddingHorizontal: 15, minHeight: 40, backgroundColor: active ? t.blueTint : t.surface, borderColor: active ? t.blue : t.border, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7, opacity: pressed ? 0.7 : 1, ...controlShape })}>{active && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.blue, shadowColor: t.blue, shadowOpacity: 0.8, shadowRadius: 5 }}/ >}{icon && <Icon name={icon} size={14} color={active ? t.blue : t.muted}/>}<Txt size={11} color={active ? t.blue : t.muted} weight={active ? '700' : '500'} style={{ letterSpacing: 0.2 }}>{label}</Txt></Pressable>;
}
export function Metric({ label, value, unit, icon, state, detail, onPress }: { label: string; value: string | number; unit?: string; icon?: IconName; state?: string; detail?: string; onPress?: () => void }) {
  const t = useTheme();
  const unavailable = state?.toLowerCase() === 'unavailable' || value === 'Unavailable';
  return <Card onPress={onPress} style={{ flex: 1, minWidth: 135, padding: 18 }}><View style={{ width: 21, height: 3, borderRadius: 2, backgroundColor: unavailable ? t.subtle : t.blue, marginBottom: 17 }}/><View style={styles.between}><Txt size={11} color={t.muted} weight="600" style={{ letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Txt>{icon && <Icon name={icon} size={16} color={unavailable ? t.subtle : t.blue}/>}</View><View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 10, marginBottom: 9 }}><Txt size={unavailable ? 18 : 30} weight="500" color={unavailable ? t.muted : t.text} style={{ letterSpacing: -1, fontVariant: ['tabular-nums'] }}>{value}</Txt>{unit && <Txt size={13} color={t.muted}>{unit}</Txt>}</View>{state && <Badge state={state}/ >}{detail && <Txt size={11} color={t.muted} style={{ marginTop: 6 }}>{detail}</Txt>}</Card>;
}
export function EmptyState({ title, description, icon = 'activity', action, onAction }: { title: string; description: string; icon?: IconName; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return <Card style={{ alignItems: 'center', paddingVertical: 45, gap: 15 }}><View style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: t.blue, backgroundColor: t.blueTint, alignItems: 'center', justifyContent: 'center', shadowColor: t.blue, shadowOpacity: t.light ? 0.12 : 0.36, shadowRadius: 17 }}><Icon name={icon} color={t.blue} size={26}/></View><Txt size={20} weight="600" style={{ textAlign: 'center' }}>{title}</Txt><Txt color={t.muted} style={{ textAlign: 'center', maxWidth: 470 }}>{description}</Txt>{action && onAction && <Button label={action} onPress={onAction} variant="secondary"/>}</Card>;
}
export function InfoNote({ children, icon = 'info' }: { children: React.ReactNode; icon?: IconName }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 15 }}><Icon name={icon} size={15} color={t.muted}/><Txt size={12} color={t.muted} style={{ flex: 1 }}>{children}</Txt></View>;
}
export const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, stack: { gap: 20 } });
