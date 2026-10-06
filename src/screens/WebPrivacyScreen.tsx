import React, { useMemo, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { Badge, Button, Card, EmptyState, Icon, InfoNote, Metric, SectionHeading, Txt, styles } from '../components/ui';
import { filterConnections } from '../services/analytics';
import { createNetworkRule } from '../services/networkRules';
import { analyzeWebAddress, WebPrivacyReview } from '../services/webPrivacy';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';

export function WebPrivacyScreen() {
  const { dataset, range, localReputation, addNetworkRule, openDetail, toast } = useApp();
  const t = useTheme();
  const [address, setAddress] = useState('');
  const [review, setReview] = useState<WebPrivacyReview | null>(null);
  const [error, setError] = useState('');
  const webRelated = useMemo(() => filterConnections(dataset, { range }).filter(event => ['Advertising', 'Analytics', 'Attribution', 'Marketing'].includes(event.category) || event.potentialTracker).slice(0, 10), [dataset, range]);
  const runReview = () => { try { setReview(analyzeWebAddress(address, localReputation)); setError(''); } catch (caught) { setReview(null); setError(caught instanceof Error ? caught.message : 'This address could not be reviewed.'); } };
  const saveRule = (action: 'alert' | 'block') => {
    if (!review) return;
    const rule = createNetworkRule(action, 'domain', review.domain);
    if (!rule) return;
    addNetworkRule(rule);
    toast(`${action === 'alert' ? 'Alert' : 'Block preview'} rule saved for ${review.domain}. No traffic was changed.`);
  };
  return <View style={styles.stack}>
    <Card style={{ backgroundColor: t.blueTint, borderColor: t.blue }}><View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="compass" color={t.blue} size={21}/></View><View style={{ flex: 1 }}><Txt size={17} weight="700">Inspect a link before you open it.</Txt><Txt size={12} color={t.muted}>Local checks for HTTPS, lookalike domains, redirects, tracking parameters, provider hints, and your imported domain list.</Txt></View></View><InfoNote>This is a local heuristic review, not a live malware or phishing lookup. A quiet result does not establish that a website is safe.</InfoNote></Card>
    <Card><SectionHeading title="Website address" subtitle="Nothing you enter is sent to a reputation service"/><TextInput accessibilityLabel="Website address to review" value={address} onChangeText={value => { setAddress(value); setError(''); setReview(null); }} onSubmitEditing={runReview} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://example.com/page?utm_source=…" placeholderTextColor={t.subtle} style={{ minHeight: 49, borderWidth: 1, borderColor: error ? t.red : t.border, backgroundColor: t.background, color: t.text, borderRadius: 11, paddingHorizontal: 14 }}/><View style={{ alignSelf: 'flex-start', marginTop: 12 }}><Button label="Review address" icon="search" onPress={runReview}/></View>{!!error && <Txt accessibilityRole="alert" size={11} color={t.red} style={{ marginTop: 10 }}>{error}</Txt>}</Card>
    {review && <>
      <View style={styles.wrap}><Metric label="Review priority" value={`${review.reviewPriority}/100`} icon="flag" state={review.reviewPriority >= 40 ? 'Estimated' : 'Observed'} detail="Local heuristics only"/><Metric label="Findings" value={review.findings.length} icon="list" detail={review.localListMatch ? 'Includes local-list match' : 'No verified reputation lookup'}/><Metric label="HTTPS" value={review.normalizedUrl.startsWith('https:') ? 'Yes' : 'No'} icon="lock" state={review.normalizedUrl.startsWith('https:') ? 'Observed' : 'Estimated'}/></View>
      <Card><SectionHeading title={review.domain} subtitle={review.categories.length ? review.categories.join(' · ') : 'No bundled provider classification'}/>{review.findings.map((finding, index) => <View key={finding.id} style={{ flexDirection: 'row', gap: 11, paddingVertical: 13, borderTopWidth: index ? 1 : 0, borderColor: t.border }}><Icon name={finding.severity === 'important' ? 'alert-triangle' : finding.severity === 'review' ? 'flag' : 'info'} color={finding.severity === 'important' ? t.red : finding.severity === 'review' ? t.amber : t.cyan}/><View style={{ flex: 1 }}><Txt size={13} weight="700">{finding.title}</Txt><Txt size={11} color={t.muted} style={{ marginTop: 3 }}>{finding.detail}</Txt></View></View>)}
        {review.sanitizedUrl !== review.normalizedUrl && <View style={{ padding: 13, borderRadius: 12, backgroundColor: t.elevated, marginTop: 10 }}><Txt size={10} color={t.cyan} weight="700">TRACKING PARAMETERS REMOVED</Txt><Txt selectable size={11} style={{ marginTop: 5 }}>{review.sanitizedUrl}</Txt></View>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 }}><Button small label="Save alert rule" icon="flag" variant="secondary" onPress={() => saveRule('alert')}/><Button small label="Preview block rule" icon="slash" variant="ghost" onPress={() => saveRule('block')}/><Button small label="Open address" icon="external-link" variant="ghost" onPress={() => { void Linking.openURL(review.normalizedUrl).catch(() => toast('This address could not be opened.')); }}/></View><InfoNote>Saved rules evaluate records loaded into IPward. They do not filter Safari or another app until a native filtering provider is implemented and authorized.</InfoNote>
      </Card>
    </>}
    <Card><SectionHeading title="Browser privacy checklist" subtitle="Controls available from your phone and browser"/>{[
      ['shield', 'Fraudulent website warnings', 'Keep the browser’s built-in phishing and fraudulent-site warning enabled.'],
      ['eye-off', 'Cross-site tracking', 'Use the browser’s cross-site tracking prevention and review exceptions.'],
      ['database', 'Cookies and site data', 'Clear site data selectively when a site behaves unexpectedly or after a sensitive session.'],
      ['navigation', 'Link tracking parameters', 'Review long referral links and remove known campaign parameters when practical.'],
      ['download', 'Downloads', 'Open unexpected downloads only after verifying the sender and file type.'],
    ].map(([icon, title, detail], index) => <View key={title} style={{ flexDirection: 'row', gap: 11, paddingVertical: 13, borderTopWidth: index ? 1 : 0, borderColor: t.border }}><Icon name={icon as 'shield'} color={t.cyan}/><View style={{ flex: 1 }}><Txt size={13} weight="600">{title}</Txt><Txt size={11} color={t.muted}>{detail}</Txt></View></View>)}<InfoNote>A Safari content blocker or system URL filter requires a separately implemented native extension and store-reviewed capability. This screen does not claim that those protections are active.</InfoNote></Card>
    <Card><SectionHeading title="Tracker-related destinations" subtitle={`${range} · loaded network evidence`}/>{webRelated.map(event => <Pressable key={event.id} accessibilityRole="button" onPress={() => openDetail({ type: 'connection', id: event.id })} style={({ pressed }) => ({ flexDirection: 'row', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderColor: t.border, opacity: pressed ? .65 : 1 })}><View style={{ flex: 1 }}><Txt size={12} weight="600">{event.domain}</Txt><Txt size={10} color={t.muted}>{event.category} · {event.reportHits ?? 1} {event.source === 'user-import' ? 'reported contacts' : 'events'}</Txt></View><Badge state={event.provenance.state}/><Icon name="chevron-right" size={15}/></Pressable>)}{!webRelated.length && <EmptyState title="No tracker-related destinations in this range" description="Import a report or choose another time range. This does not mean browsing is tracker-free." icon="compass"/>}</Card>
  </View>;
}
