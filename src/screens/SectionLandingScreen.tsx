import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Icon, InfoNote, SectionHeading, Txt, type IconName } from '../components/ui';
import { useApp, type Route } from '../state/AppContext';
import { useTheme } from '../theme';

type Section = 'Network' | 'Data' | 'Device';
type Feature = { title: string; description: string; route: Route; icon: IconName; focus?: 'connectivity' | 'quick' };

const features: Record<Section, Feature[]> = {
  Network: [
    { title: 'Live', description: 'Open the connection feed. Imported reports remain historical, not live traffic.', route: 'Live Monitor', icon: 'radio' },
    { title: 'Domains', description: 'Trace domain contacts, apps and available connection details.', route: 'Connections', icon: 'git-branch' },
    { title: 'Companies', description: 'Explore organizations and endpoints behind known contacts.', route: 'Destinations', icon: 'globe' },
    { title: 'History', description: 'Review recorded connections across the selected duration.', route: 'Connections', icon: 'clock' },
  ],
  Data: [
    { title: 'Apps', description: 'See the evidence available for each app in one place.', route: 'Apps', icon: 'grid' },
    { title: 'Data types', description: 'Explore access categories and your imported account-data inventory.', route: 'Privacy Map', icon: 'layers' },
    { title: 'Trackers', description: 'Review potential tracking and ad signals without assuming a data transfer.', route: 'Marketing', icon: 'target' },
    { title: 'Recipients', description: 'Follow the data journey and its clearly marked uncertainty.', route: 'Privacy Map', icon: 'share-2' },
  ],
  Device: [
    { title: 'Permissions', description: 'Review available resource-access evidence and app associations.', route: 'Sensors', icon: 'unlock' },
    { title: 'Sensors', description: 'Explore camera, microphone and location access intervals.', route: 'Sensors', icon: 'eye' },
    { title: 'System', description: 'Open guided device-security checks and review their coverage.', route: 'Device Checks', icon: 'smartphone', focus: 'quick' },
    { title: 'Wi-Fi', description: 'Run the available connectivity and DNS diagnostics.', route: 'Device Checks', icon: 'wifi', focus: 'connectivity' },
  ],
};

const descriptions: Record<Section, { intro: string; note: string; stat: (connections: number, apps: number, sensors: number) => string; icon: IconName }> = {
  Network: {
    intro: 'Where this workspace shows your phone communicating.',
    note: 'Connection records are only as current and complete as their source. An imported report does not provide continuous traffic, payload contents or reliable transfer volumes.',
    stat: connections => `${connections} connection records`, icon: 'git-branch',
  },
  Data: {
    intro: 'What apps may access, and who appears in the visible data journey.',
    note: 'Resource access, domain contact and actual data transmission are different kinds of evidence. IPward keeps them separate.',
    stat: (_connections, apps) => `${apps} apps in workspace`, icon: 'layers',
  },
  Device: {
    intro: 'The phone itself: sensitive resources, system guidance and connectivity.',
    note: 'Mobile operating systems limit what an app can inspect. These views do not certify device integrity or reveal the content of sensor use.',
    stat: (_connections, _apps, sensors) => `${sensors} sensor intervals`, icon: 'smartphone',
  },
};

export function SectionLandingScreen({ section }: { section: Section }) {
  const { dataset, mode, navigate } = useApp();
  const t = useTheme();
  const content = descriptions[section];
  const open = (feature: Feature) => feature.focus
    ? router.push(`/device-checks?focus=${feature.focus}`)
    : navigate(feature.route);

  return <View style={{ gap: 18 }}>
    <Card style={{ backgroundColor: t.blueTint, borderColor: t.blue }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
        <View style={{ width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: t.elevated, borderWidth: 1, borderColor: t.blue }}><Icon name={content.icon} color={t.blue} size={23}/></View>
        <View style={{ flex: 1 }}><Txt size={10} color={t.blue} weight="700" style={{ letterSpacing: 1.5 }}>{section.toUpperCase()} / SIGNALS</Txt><Txt size={18} weight="600" style={{ marginTop: 3 }}>{content.intro}</Txt><Txt size={11} color={t.muted} style={{ marginTop: 10 }}>{mode === 'demo' ? 'Sample workspace' : 'Device workspace'} · {content.stat(dataset.connections.length, dataset.apps.length, dataset.sensors.length)}</Txt></View>
      </View>
    </Card>
    <Card>
      <SectionHeading title={`Explore ${section.toLowerCase()}`} subtitle="Choose the question you want to answer"/>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {features[section].map(feature => <Pressable key={feature.title} accessibilityRole="button" accessibilityLabel={`Open ${feature.title}`} onPress={() => open(feature)} style={({ pressed }) => ({ flexGrow: 1, flexBasis: 210, minWidth: 180, minHeight: 137, padding: 16, borderWidth: 1, borderColor: pressed ? t.blue : t.border, borderRadius: 16, backgroundColor: t.elevated, opacity: pressed ? .77 : 1 })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><Icon name={feature.icon} size={18} color={t.cyan}/><Txt size={14} weight="700" style={{ flex: 1 }}>{feature.title}</Txt><Icon name="arrow-up-right" size={14} color={t.muted}/></View>
          <Txt size={11} color={t.muted} style={{ marginTop: 12, lineHeight: 17 }}>{feature.description}</Txt>
        </Pressable>)}
      </View>
    </Card>
    <InfoNote>{content.note}</InfoNote>
  </View>;
}
