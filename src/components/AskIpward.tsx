import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { ConnectionEvent } from '../types';
import { useTheme } from '../theme';
import { Badge, Button, Card, InfoNote, SectionHeading, Txt } from './ui';

const prompts = ['Why might it connect?', 'Could it be tracking?', 'What data was sent?'];

function explain(event: ConnectionEvent, appName: string, ownerName: string | null, question: string) {
  const asksTracking = /track|advertis|cross.app|profil/i.test(question);
  const asksPayload = /data|send|payload|content|upload/i.test(question);
  const asksOwner = /who|own|company|provider/i.test(question);
  if (event.source === 'user-import') {
    const ownerIsHint = event.organizationId?.startsWith('hint-company:') ?? false;
    const timing = event.reportHits === undefined ? '' : ` Apple reports ${event.reportHits.toLocaleString()} contact${event.reportHits === 1 ? '' : 's'} in its rolling report window.`;
    const owner = ownerName
      ? ownerIsHint
        ? ` IPWard's small local directory associates this domain suffix with ${ownerName}; treat that as an estimate, not a verified owner.`
        : ` Apple includes ${ownerName} as the domain-owner label.`
      : ' Apple did not identify a domain owner in this report.';
    if (asksTracking) return event.potentialTracker
      ? `Apple marks ${event.domain} as potentially collecting information across apps or sites. That is a broad flag, not proof that ${appName} used it for advertising or that this contact tracked you.${owner}`
      : `Apple did not mark ${event.domain} as a potential cross-app tracker in this report. That absence does not prove the domain never tracks users.${owner}`;
    if (asksPayload) return `The imported report does not include message contents, personal data fields, or transfer bytes for ${event.domain}. It confirms a domain contact by ${appName}; it cannot show exactly what was sent.${owner}`;
    if (asksOwner) return ownerName ? ownerIsHint
      ? `IPWard's local suffix directory associates ${event.domain} with ${ownerName}. This is an estimated provider hint; Apple did not supply an owner label, and the destination may be infrastructure rather than the data recipient.`
      : `${ownerName} is the owner label Apple supplied for ${event.domain}. That identifies a likely organization, not the purpose or content of this particular contact.`
      : `The report does not identify an owner for ${event.domain}. IPWard leaves the company unknown rather than guessing.`;
    const first = event.reportFirstAt ? ` Its first reported contact was ${new Date(event.reportFirstAt).toLocaleString()};` : '';
    return `Apple's report records ${appName} contacting ${event.domain}.${timing}${first} the latest reported contact was ${new Date(event.timestamp).toLocaleString()}.${owner} A domain can support several features, so the report cannot establish why this specific contact happened.`;
  }
  if (event.source === 'demo') return `This is an illustrative IPWard sample, not activity collected from your phone. The sample labels ${event.domain} as ${event.category}${ownerName ? ` and associates it with ${ownerName}` : ''}. Those labels demonstrate the interface; they are not a verified explanation of a real app's behavior.`;
  return `The available record shows ${appName} contacting ${event.domain}. Its owner is ${ownerName ?? 'unknown'} and its category is ${event.category}. This source does not provide enough evidence to identify the purpose or contents of the contact.`;
}

export function AskIpward({ event, appName, ownerName }: { event: ConnectionEvent; appName: string; ownerName: string | null }) {
  const t = useTheme();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const ask = (value = question) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setAnswer(explain(event, appName, ownerName, trimmed));
  };
  return <Card style={{ marginTop: 18, backgroundColor: t.light ? '#F0F3F2' : '#1B242B' }}>
    <SectionHeading title="Ask IPWard" subtitle="A private explanation grounded in this record"/>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
      {prompts.map(prompt => <Button key={prompt} small variant="secondary" label={prompt} onPress={() => ask(prompt)}/ >)}
    </View>
    <TextInput value={question} onChangeText={setQuestion} onSubmitEditing={() => ask()} returnKeyType="send" placeholder="Ask about this domain…" placeholderTextColor={t.subtle} accessibilityLabel="Ask IPWard about this domain" style={{ minHeight: 47, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: t.border, color: t.text, backgroundColor: t.background, marginBottom: 10 }}/>
    <Button label="Explain this connection" icon="message-circle" variant="secondary" onPress={() => ask()}/>
    {answer && <View style={{ marginTop: 15, padding: 14, backgroundColor: t.elevated, borderRadius: 12, borderLeftWidth: 2, borderLeftColor: t.blue }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}><Txt size={11} weight="700" color={t.blue}>IPWARD EXPLANATION</Txt><Badge state={event.classification.source === 'bundled-provider-hints' ? 'Estimated' : event.source === 'user-import' ? 'Confirmed' : 'Observed'}/></View><Txt size={12} color={t.muted}>{answer}</Txt></View>}
    <InfoNote>Answers are generated on this device from the displayed record. No AI service is connected and your question is not sent anywhere.</InfoNote>
  </Card>;
}
