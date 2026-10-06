import React, { useState } from 'react';
import { View } from 'react-native';
import { ConnectionEvent } from '../types';
import { useTheme } from '../theme';
import { useApp } from '../state/AppContext';
import { Badge, Button, Card, SectionHeading, Txt } from './ui';

function EvidenceItem({ label, state, children }: { label: string; state: 'Confirmed' | 'Observed' | 'Estimated' | 'Unavailable'; children: React.ReactNode }) {
  const t = useTheme();
  return <View style={{ paddingVertical: 12, borderTopWidth: 1, borderColor: t.border }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <Txt size={12} weight="600" style={{ flexShrink: 1 }}>{label}</Txt>
      <Badge state={state}/>
    </View>
    <Txt size={11} color={t.muted} style={{ marginTop: 5 }}>{children}</Txt>
  </View>;
}

export function DataUseEvidence({ event, appName }: { event: ConnectionEvent; appName: string }) {
  const t = useTheme();
  const { dataset } = useApp();
  const [guideOpen, setGuideOpen] = useState(false);
  const imported = event.source === 'user-import';
  const demo = event.source === 'demo';
  const accessTypes = event.appId
    ? [...new Set(dataset.sensors.filter(item => item.appId === event.appId && item.source === event.source).map(item => item.sensor))]
    : [];
  const endpointCategories = event.classification.categories.filter(category => category !== 'Unknown');
  const hasCategoryHint = endpointCategories.length > 0 && event.classification.source !== 'unknown';

  return <Card style={{ marginTop: 18 }}>
    <SectionHeading title="What IPward can show" subtitle={demo ? 'Fictional sample, not activity from your phone' : imported ? 'From the Apple report you imported' : 'From this connection record'}/>
    <EvidenceItem label="App and destination" state={demo ? 'Observed' : event.provenance.state}>
      {demo ? `Sample: ${appName} → ${event.domain}.` : imported ? `${appName} contacted ${event.domain} ${event.reportHits ?? 1} time${(event.reportHits ?? 1) === 1 ? '' : 's'} in the report window.` : `${appName} contacted ${event.domain}.`}
    </EvidenceItem>
    {imported && <EvidenceItem label="Potential cross-app collection" state="Confirmed">
      {event.potentialTracker ? 'Apple flags this domain as potentially collecting information across apps or sites.' : 'Apple did not flag this domain in this report. This does not rule out tracking.'}
    </EvidenceItem>}
    <EvidenceItem label="Resource access categories" state={imported && accessTypes.length ? 'Confirmed' : demo && accessTypes.length ? 'Observed' : 'Unavailable'}>
      {imported && accessTypes.length ? `${accessTypes.join(', ')} appear in separate access records for ${appName}. The report does not say they were sent to this domain.` : imported ? `No resource access categories for ${appName} are present in the loaded report.` : demo && accessTypes.length ? `Sample only: ${accessTypes.join(', ')}. These fictional events are not activity from your phone.` : demo ? 'No sample access records for this app.' : 'This connection record does not include resource access categories.'}
    </EvidenceItem>
    <EvidenceItem label="Input modality behind this contact" state="Unavailable">
      The domain record does not identify whether this contact came from microphone audio, browser typing, a photo, or another input. Separate access records cannot establish what was sent.
    </EvidenceItem>
    <EvidenceItem label="Possible endpoint purpose" state={hasCategoryHint ? 'Estimated' : 'Unavailable'}>
      {hasCategoryHint ? `${endpointCategories.join(', ')}. ${demo ? 'This is a sample label.' : 'This is a domain-based hint, not proof of what personal data was collected or why this contact happened.'}` : 'No purpose category is available for this domain.'}
    </EvidenceItem>
    <EvidenceItem label="Exact words or data sent" state="Unavailable">
      This record has no spoken words, typed text, message content, or readable network payload.
    </EvidenceItem>
    <EvidenceItem label="Reason for a specific ad" state="Unavailable">
      A domain contact does not reveal an advertiser’s targeting decision or whether this contact influenced an ad.
    </EvidenceItem>
    <View style={{ marginTop: 9 }}>
      <Button small label={guideOpen ? 'Hide ways to look' : 'How to look for exact words'} icon={guideOpen ? 'chevron-up' : 'search'} variant="secondary" onPress={() => setGuideOpen(open => !open)}/>
    </View>
    {guideOpen && <View style={{ marginTop: 14, padding: 14, borderRadius: 12, backgroundColor: t.elevated, gap: 10 }}>
      <Txt size={12} weight="600">Check sources that may hold the words</Txt>
      <Txt size={11} color={t.muted}>1. In {appName}, check its search, activity, or voice history for a saved query or transcript, if that app offers one.</Txt>
      <Txt size={11} color={t.muted}>2. In the service’s privacy settings, look for “Download your data” or an access request. The export may contain saved searches or transcripts, depending on the service.</Txt>
      <Txt size={11} color={t.muted}>3. If a specific ad offers “Why this ad?”, open it and the provider’s ad preferences to see any interests or reasons disclosed.</Txt>
      <Txt size={11} color={t.subtle}>Words found in a history or export show what that service retained. They do not establish what this domain received or why an ad appeared.</Txt>
    </View>}
  </Card>;
}
