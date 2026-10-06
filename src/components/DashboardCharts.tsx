import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Icon, Txt, styles } from './ui';

export type BarChartRow = { id: string; label: string; value: number; displayValue?: string; detail?: string; color?: string };

export function HorizontalBarChart({ rows, color, empty = 'No data in this range.', onPress }: { rows: readonly BarChartRow[]; color: string; empty?: string; onPress?: (row: BarChartRow) => void }) {
  const t = useTheme();
  const max = Math.max(1, ...rows.map(row => row.value));
  if (!rows.length) return <Txt size={11} color={t.subtle} style={{ paddingVertical: 14 }}>{empty}</Txt>;
  return <View>{rows.map(row => {
    const content = <><View style={{ ...styles.between, gap: 8 }}><View style={{ flex: 1, minWidth: 0 }}><Txt size={11} weight="600" numberOfLines={1}>{row.label}</Txt>{row.detail && <Txt size={9} color={t.subtle} numberOfLines={1}>{row.detail}</Txt>}</View><Txt size={12} color={row.color ?? color} weight="700">{row.displayValue ?? row.value}</Txt>{onPress && <Icon name="chevron-right" size={12}/>}</View><View style={{ height: 4, borderRadius: 3, backgroundColor: t.surface, marginTop: 7, overflow: 'hidden' }}><View style={{ width: `${Math.max(4, row.value / max * 100)}%`, height: 4, borderRadius: 3, backgroundColor: row.color ?? color }}/></View></>;
    return onPress ? <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`${row.label}, ${row.displayValue ?? row.value}${row.detail ? `, ${row.detail}` : ''}`} onPress={() => onPress(row)} style={({ pressed }) => ({ paddingVertical: 9, borderTopWidth: 1, borderColor: t.border, opacity: pressed ? .62 : 1 })}>{content}</Pressable> : <View key={row.id} style={{ paddingVertical: 9, borderTopWidth: 1, borderColor: t.border }}>{content}</View>;
  })}</View>;
}

export function HourlyBarChart({ values, color, accessibilityLabel }: { values: readonly number[]; color: string; accessibilityLabel: string }) {
  const t = useTheme();
  const max = Math.max(1, ...values);
  return <View accessible accessibilityLabel={accessibilityLabel}>
    <View style={{ height: 104, flexDirection: 'row', alignItems: 'flex-end', gap: 3, paddingTop: 8, borderBottomWidth: 1, borderColor: t.border }}>{values.map((value, index) => <View key={index} style={{ flex: 1, height: `${Math.max(value ? 5 : 1, value / max * 100)}%`, minWidth: 2, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: value ? color : t.surface, opacity: value ? .82 : .35 }}/>)}</View>
    <View style={{ ...styles.between, marginTop: 7 }}><Txt size={8} color={t.subtle}>12 AM</Txt><Txt size={8} color={t.subtle}>6 AM</Txt><Txt size={8} color={t.subtle}>12 PM</Txt><Txt size={8} color={t.subtle}>6 PM</Txt><Txt size={8} color={t.subtle}>11 PM</Txt></View>
  </View>;
}

export function ChartPanel({ title, subtitle, color, children }: { title: string; subtitle: string; color: string; children: React.ReactNode }) {
  const t = useTheme();
  return <View style={{ flex: 1, minWidth: 225, padding: 14, borderRadius: 15, backgroundColor: t.elevated, borderWidth: 1, borderColor: t.border }}><Txt size={10} color={color} weight="700" style={{ letterSpacing: .75 }}>{title}</Txt><Txt size={10} color={t.muted} style={{ marginTop: 4, marginBottom: 8 }}>{subtitle}</Txt>{children}</View>;
}
