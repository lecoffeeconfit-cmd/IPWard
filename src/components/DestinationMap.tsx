import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

export interface DestinationMapProps {
  height?: number;
  light?: boolean;
  onCountryPress?: (country: string) => void;
}

type Point = readonly [number, number];

// Deliberately schematic outlines. This is a destination illustration, not geolocation.
const continents: readonly (readonly Point[])[] = [
  [[22, 48], [38, 32], [66, 28], [80, 38], [100, 34], [112, 47], [125, 48], [117, 58], [101, 63], [107, 73], [96, 85], [83, 89], [79, 100], [69, 99], [58, 85], [46, 82], [42, 68], [24, 62]],
  [[80, 101], [91, 100], [101, 113], [120, 120], [124, 134], [114, 144], [109, 162], [98, 177], [91, 165], [88, 145], [80, 133], [79, 117]],
  [[119, 24], [136, 18], [147, 26], [139, 45], [125, 46], [119, 37]],
  [[164, 59], [173, 46], [184, 44], [188, 28], [201, 23], [205, 33], [198, 48], [216, 50], [220, 62], [208, 74], [192, 74], [184, 68], [172, 71]],
  [[175, 78], [191, 72], [209, 83], [217, 99], [208, 111], [201, 130], [193, 141], [184, 132], [179, 114], [167, 100], [166, 88]],
  [[207, 36], [227, 30], [247, 35], [258, 29], [283, 34], [307, 31], [331, 43], [337, 56], [319, 65], [305, 64], [298, 77], [286, 87], [275, 88], [282, 99], [274, 108], [263, 98], [255, 101], [251, 115], [242, 104], [235, 91], [222, 91], [210, 77], [220, 61], [209, 54]],
  [[272, 111], [283, 112], [291, 123], [311, 123], [316, 130], [305, 133], [294, 128], [280, 125]],
  [[282, 145], [301, 136], [314, 140], [321, 153], [310, 165], [288, 165], [280, 158]],
  [[329, 161], [335, 168], [328, 176], [324, 170]],
  [[218, 128], [222, 133], [218, 147], [213, 143]],
  [[307, 75], [311, 81], [306, 89], [303, 85]],
];

function insidePolygon(x: number, y: number, polygon: readonly Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const mapDots: Point[] = [];
for (let y = 20; y < 180; y += 4.8) {
  for (let x = 20; x < 342; x += 4.8) {
    if (continents.some(polygon => insidePolygon(x, y, polygon))) mapDots.push([x, y]);
  }
}

const destinations = [
  { country: 'United States', x: 86, y: 77, labelX: 85, labelY: 101, targetX: 85, targetY: 96, anchor: 'middle' as const, arc: 'M57 73 Q72 56 86 77' },
  { country: 'Ireland', x: 171, y: 62, labelX: 156, labelY: 42, targetX: 150, targetY: 38, anchor: 'middle' as const, arc: 'M57 73 Q112 1 171 62' },
  { country: 'Germany', x: 188, y: 65, labelX: 215, labelY: 89, targetX: 216, targetY: 85, anchor: 'middle' as const, arc: 'M57 73 Q123 8 188 65' },
  { country: 'Singapore', x: 273, y: 115, labelX: 273, labelY: 145, targetX: 274, targetY: 141, anchor: 'middle' as const, arc: 'M57 73 Q163 12 273 115' },
];

export const DestinationMap = memo(function DestinationMap({ height = 190, light = false, onCountryPress }: DestinationMapProps) {
  const [width, setWidth] = useState(360);
  const scale = Math.min(width / 360, height / 195);
  const horizontalOffset = (width - 360 * scale) / 2;
  const verticalOffset = (height - 195 * scale) / 2;
  const blue = light ? '#4773BD' : '#8DAFFF';
  const cyan = light ? '#398A82' : '#84D9D0';
  const textColor = light ? '#495E78' : '#A8B5C8';

  return (
    <View style={{ width: '100%', height }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <Svg
        width="100%"
        height={height}
        viewBox="0 0 360 195"
        accessible={onCountryPress ? undefined : true}
        accessibilityRole="image"
        accessibilityLabel="Illustration of connection destinations in the United States, Ireland, Germany, and Singapore. Locations are approximate."
      >
        <G fill={light ? '#B6C5D6' : '#344152'}>
          {mapDots.map(([x, y], index) => <Circle key={index} cx={x} cy={y} r="1.05" />)}
        </G>
        {destinations.map(destination => (
          <G key={destination.country}>
            <Path d={destination.arc} fill="none" stroke={blue} strokeWidth="0.9" strokeOpacity="0.5" />
            <Circle cx={destination.x} cy={destination.y} r="8" fill={blue} opacity="0.08" />
            <Circle cx={destination.x} cy={destination.y} r="4.7" fill={blue} opacity="0.15" />
            <Circle cx={destination.x} cy={destination.y} r="2.6" fill={blue} />
            <Path d={`M${destination.x} ${destination.y + (destination.labelY > destination.y ? 6 : -6)} L${destination.labelX} ${destination.labelY + (destination.labelY > destination.y ? -10 : 5)}`} stroke={blue} strokeWidth="0.6" opacity="0.4" />
            <SvgText x={destination.labelX} y={destination.labelY} fill={textColor} fontSize="9" fontWeight="500" textAnchor={destination.anchor}>{destination.country}</SvgText>
          </G>
        ))}
        <Circle cx="57" cy="73" r="10" fill={cyan} opacity="0.08" />
        <Circle cx="57" cy="73" r="5.5" stroke={cyan} strokeWidth="0.7" fill={light ? '#E9F3F3' : '#173434'} />
        <Circle cx="57" cy="73" r="2.2" fill={cyan} />
        <SvgText x="43" y="91" fill={cyan} fontSize="8" textAnchor="end">DEVICE</SvgText>
      </Svg>
      {onCountryPress ? destinations.map(destination => (
        <Pressable
          key={destination.country}
          accessibilityRole="button"
          accessibilityLabel={`View connections to ${destination.country}`}
          accessibilityHint="Opens the country connection details."
          onPress={() => onCountryPress(destination.country)}
          style={({ pressed }) => [styles.countryTarget, {
            left: horizontalOffset + destination.targetX * scale - 36,
            top: verticalOffset + destination.targetY * scale - 26,
            backgroundColor: pressed ? (light ? '#4773BD18' : '#8DAFFF18') : 'transparent',
          }]}
        />
      )) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  countryTarget: { position: 'absolute', width: 72, height: 52, borderRadius: 12 },
});

export default DestinationMap;
