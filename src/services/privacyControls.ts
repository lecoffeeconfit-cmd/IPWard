import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { AppProfile, SensorType } from '../types';

export type PrivacyControl = SensorType | 'Cross-app tracking' | 'Personalized ads';

export const sensorControls: SensorType[] = ['Microphone', 'Camera', 'Location', 'Photos', 'Contacts', 'Bluetooth', 'Calendar'];
export const privacyControls: PrivacyControl[] = [...sensorControls, 'Cross-app tracking', 'Personalized ads'];

/** An imported Apple app cannot be controlled from an Android phone. */
export function controlPlatform(app: AppProfile | undefined): 'ios' | 'android' | 'unknown' {
  if (app?.source === 'user-import') return 'ios';
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS;
  return 'unknown';
}

export function controlInstructions(control: PrivacyControl, appName: string, platform: 'ios' | 'android' | 'unknown'): string {
  if (platform === 'ios') {
    if (control === 'Cross-app tracking') return `On the iPhone, open Settings → Privacy & Security → Tracking. Turn off tracking for ${appName}, or turn off Allow Apps to Request to Track for all apps.`;
    if (control === 'Personalized ads') return 'For Apple-delivered ads, open Settings → Privacy & Security → Apple Advertising and turn off Personalized Ads. For ads inside another app, review that app’s own ad and privacy choices.';
    const section = control === 'Location' ? 'Location Services' : control === 'Calendar' ? 'Calendars' : control;
    return `On the iPhone, open Settings → Privacy & Security → ${section}. Find ${appName} and turn off its access. If it is not listed, check Settings → Apps → ${appName} for available permissions.`;
  }
  if (platform === 'android') {
    if (control === 'Cross-app tracking' || control === 'Personalized ads') return `Open Android Settings → Apps → ${appName}. Review its privacy and ad choices in the app. Also review Settings → Security & privacy → Privacy for system controls. These settings do not stop all ads or all data collection.`;
    const section = control === 'Photos' ? 'Photos and videos' : control === 'Bluetooth' ? 'Nearby devices' : control;
    return `Open Android Settings → Apps → ${appName} → Permissions → ${section}, then choose Don't allow if offered. You can also review apps by permission type in Settings → Security & privacy → Privacy → Permission manager.`;
  }
  return `On the phone that produced these records, open system Settings and review ${appName}’s ${control.toLowerCase()} permission or privacy choices.`;
}

export async function openAndroidControlSettings(app: AppProfile | undefined): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    if (app?.source === 'device-activity' && /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(app.identifier)) {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, { data: `package:${app.identifier}` });
    } else {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.PRIVACY_SETTINGS);
    }
    return true;
  } catch {
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.SETTINGS);
      return true;
    } catch { return false; }
  }
}
