import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SecurityScreen } from '../screens/SecurityScreen';

export default function DeviceChecksScreen() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  return <SecurityScreen key={focus === 'connectivity' ? 'connectivity' : 'quick'}/>;
}
