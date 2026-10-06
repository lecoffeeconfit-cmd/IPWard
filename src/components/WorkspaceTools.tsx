import React from 'react';
import { View } from 'react-native';
import { Button, Card, Icon, SectionHeading, Txt } from './ui';
import { useApp, type Route } from '../state/AppContext';
import { useTheme } from '../theme';
import { primaryDestinations, sectionForRoute, sectionLabel, sectionLinks, type PrimaryRoute, type SectionLink } from '../navigation/sections';

export function WorkspaceTools({ route }: { route: Route }) {
  const { navigate } = useApp();
  const t = useTheme();
  const section = sectionForRoute[route];
  const isLanding = route === section;
  const landing = primaryDestinations.find(item => item.route === section)!;
  const tools: readonly SectionLink[] = isLanding ? sectionLinks[section] : [
    { route: section, title: sectionLabel(section), detail: `Return to the ${sectionLabel(section)} landing page.`, icon: landing.icon },
    ...sectionLinks[section].filter(tool => tool.route !== route),
  ];

  return <Card>
    <SectionHeading title={`${sectionLabel(section)} tools`} subtitle={isLanding ? 'Related views in this part of IPward.' : `More views grouped under ${sectionLabel(section)}.`}/>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {tools.map((tool, index) => <View key={`${tool.route}-${index}`} style={{ flexGrow: 1, flexBasis: 210, minWidth: 190, padding: 13, borderWidth: 1, borderColor: t.border, borderRadius: 14, backgroundColor: t.elevated }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><Icon name={tool.icon} size={16} color={t.cyan}/><Txt size={12} weight="700" style={{ flex: 1 }}>{tool.title}</Txt></View>
        <Txt size={11} color={t.muted} style={{ marginTop: 6, minHeight: 32, lineHeight: 16 }}>{tool.detail}</Txt>
        <View style={{ alignSelf: 'flex-start', marginTop: 8 }}><Button small label={`Open ${tool.title}`} icon="arrow-up-right" variant="secondary" onPress={() => navigate(tool.route)}/></View>
      </View>)}
    </View>
  </Card>;
}

export function isPrimaryRoute(route: Route): route is PrimaryRoute {
  return primaryDestinations.some(item => item.route === route);
}
