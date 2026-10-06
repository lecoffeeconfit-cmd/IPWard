import React, { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { Txt } from './ui';

export interface SignalTrendSeries {
  id: string;
  label: string;
  color: string;
  values: readonly number[];
}

interface SeriesGeometry extends SignalTrendSeries {
  line: string;
  lastActive?: { x: number; y: number };
  total: number;
}

/** Multiple signals share one count scale so their relative volume stays meaningful. */
export const SignalTrendChart = memo(function SignalTrendChart({ series, height = 126, compact = false }: { series: readonly SignalTrendSeries[]; height?: number; compact?: boolean }) {
  const t = useTheme();
  const chartHeight = Math.max(compact ? 24 : 72, height);
  const geometry = useMemo(() => {
    const sanitized = series.map(item => ({ ...item, values: item.values.map(value => Number.isFinite(value) ? Math.max(0, value) : 0) }));
    const maximum = Math.max(1, ...sanitized.flatMap(item => item.values));
    return sanitized.map(item => {
      const points = item.values.map((value, index) => ({
        x: item.values.length === 1 ? 180 : 5 + index / Math.max(1, item.values.length - 1) * 350,
        y: chartHeight - 7 - value / maximum * (chartHeight - 20),
        value,
      }));
      const line = points.reduce((path, point, index) => {
        if (!index) return `M${point.x},${point.y}`;
        const previous = points[index - 1];
        const midpoint = (previous.x + point.x) / 2;
        return `${path} C${midpoint},${previous.y} ${midpoint},${point.y} ${point.x},${point.y}`;
      }, '');
      const lastActive = [...points].reverse().find(point => point.value > 0);
      return { ...item, line, lastActive, total: item.values.reduce((sum, value) => sum + value, 0) } satisfies SeriesGeometry;
    });
  }, [chartHeight, series]);
  const hasSignals = geometry.some(item => item.total > 0);

  return <View accessible accessibilityRole="image" accessibilityLabel={`${geometry.map(item => `${item.label}: ${item.total}`).join(', ')}. All lines use the same count scale.`} style={{ height: chartHeight, width: '100%', overflow: 'hidden' }}>
    <Svg width="100%" height={chartHeight} viewBox={`0 0 360 ${chartHeight}`} preserveAspectRatio="none">
      {[0.18, 0.46, 0.74, 0.96].map(position => <Line key={`h-${position}`} x1="0" x2="360" y1={chartHeight * position} y2={chartHeight * position} stroke={t.light ? '#CCD7D8' : '#34414A'} strokeWidth="0.7" strokeDasharray="2 6"/>)}
      {[0.2, 0.4, 0.6, 0.8].map(position => <Line key={`v-${position}`} x1={360 * position} x2={360 * position} y1="0" y2={chartHeight} stroke={t.light ? '#D7DFDF' : '#2B353E'} strokeWidth="0.55" strokeDasharray="2 7"/>)}
      {geometry.filter(item => item.total === 0).map((item, index) => <Line key={`${item.id}-zero`} x1="5" x2="355" y1={chartHeight - 7 - index * 1.5} y2={chartHeight - 7 - index * 1.5} stroke={item.color} strokeWidth="1" strokeDasharray="3 8" strokeDashoffset={index * 3} opacity={t.light ? .28 : .38}/>)}
      {geometry.filter(item => item.total > 0).map(item => <Path key={`${item.id}-glow`} d={item.line} fill="none" stroke={item.color} strokeWidth={compact ? 4.5 : 8} opacity={t.light ? 0.09 : 0.17} strokeLinejoin="round" strokeLinecap="round"/>)}
      {geometry.filter(item => item.total > 0).map(item => <Path key={item.id} d={item.line} fill="none" stroke={item.color} strokeWidth={compact ? 1.7 : 2.4} strokeLinejoin="round" strokeLinecap="round"/>)}
      {geometry.map(item => {
        const point = item.lastActive;
        return point ? <React.Fragment key={`${item.id}-point`}><Circle cx={point.x} cy={point.y} r={compact ? 3.5 : 5} fill={item.color} opacity="0.18"/><Circle cx={point.x} cy={point.y} r={compact ? 1.8 : 2.4} fill={item.color}/></React.Fragment> : null;
      })}
    </Svg>
    {!hasSignals && <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}><Txt size={11} color={t.subtle}>No recorded signals in this window</Txt></View>}
  </View>;
});

export default SignalTrendChart;
