import React, { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

export interface TrafficChartProps {
  values?: number[];
  height?: number;
  color?: string;
  light?: boolean;
  reducedMotion?: boolean;
}

/** Samples are provided by the caller; missing data renders an empty grid. */
export const TrafficChart = memo(function TrafficChart({ values, height = 95, color = '#00FF41', light = false, reducedMotion = false }: TrafficChartProps) {
  const gradientId = `traffic${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const chartHeight = Math.max(24, height);
  const scan = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const [systemReduced, setSystemReduced] = useState(true);
  const geometry = useMemo(() => {
    const samples = (values ?? []).map(value => Number.isFinite(value) ? Math.max(0, value) : 0);
    const maximum = Math.max(1, ...samples);
    const points = samples.map((value, index) => ({
      x: samples.length === 1 ? 174 : 4 + (index / Math.max(1, samples.length - 1)) * 340,
      y: chartHeight - 5 - (value / maximum) * (chartHeight - 17),
    }));
    if (points.length === 0) return { line: '', area: '', last: undefined, count: 0 };
    // Horizontal cubic handles keep each segment within its sample range.
    const line = points.reduce((path, point, index) => {
      if (!index) return `M${point.x},${point.y}`;
      const previous = points[index - 1];
      const midpoint = (previous.x + point.x) / 2;
      return `${path} C${midpoint},${previous.y} ${midpoint},${point.y} ${point.x},${point.y}`;
    }, '');
    return {
      line,
      area: `${line} L${points[points.length - 1].x},${chartHeight} L${points[0].x},${chartHeight} Z`,
      last: points[points.length - 1],
      count: points.length,
    };
  }, [values, chartHeight]);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setSystemReduced(value); }).catch(() => { /* Keep the trace still if the setting cannot be read. */ });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduced);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!width || !geometry.count || reducedMotion || systemReduced) { scan.stopAnimation(); scan.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(scan, { toValue: 1, duration: 7200, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web', isInteraction: false }));
    loop.start();
    return () => loop.stop();
  }, [width, geometry.count, reducedMotion, systemReduced, scan]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={geometry.count ? `Traffic trend across ${geometry.count} time intervals.` : 'No traffic samples for this period.'}
      style={{ height: chartHeight, width: '100%', overflow: 'hidden' }}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      <Svg width="100%" height={chartHeight} viewBox={`0 0 348 ${chartHeight}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity={light ? 0.2 : 0.19} />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {[0.22, 0.58, 0.94].map(position => (
          <Line key={position} x1="0" x2="348" y1={chartHeight * position} y2={chartHeight * position} stroke={light ? '#D9E1EB' : '#26303E'} strokeWidth="0.6" strokeDasharray="2 5" />
        ))}
        {geometry.area ? <Path d={geometry.area} fill={`url(#${gradientId})`} /> : null}
        {geometry.line ? <Path d={geometry.line} fill="none" stroke={color} strokeWidth="10" opacity={light ? 0.12 : 0.23} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {geometry.line ? <Path d={geometry.line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {geometry.last ? <Circle cx={geometry.last.x} cy={geometry.last.y} r="6" fill={color} opacity="0.18" /> : null}
        {geometry.last ? <Circle cx={geometry.last.x} cy={geometry.last.y} r="2.7" fill={color} /> : null}
      </Svg>
      {width > 0 && !reducedMotion && !systemReduced && geometry.count > 0 && <Animated.View style={{ pointerEvents: 'none', position: 'absolute', top: 3, bottom: 3, width: 1, backgroundColor: color, opacity: scan.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.18, 0.18, 0] }), transform: [{ translateX: scan.interpolate({ inputRange: [0, 1], outputRange: [0, width] }) }] }}/ >}
    </View>
  );
});

export default TrafficChart;
