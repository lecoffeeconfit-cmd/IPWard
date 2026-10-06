import React, { useMemo, useState } from 'react';
import { Platform, Pressable, Switch, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Badge, Button, Card, Icon, InfoNote, Metric, Pill, SectionHeading, styles, Txt } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { filterByRange } from '../services/analytics';
import { createNetworkRule, evaluateNetworkRules, normalizeRuleValue } from '../services/networkRules';
import { MAX_REPUTATION_LIST_BYTES, parseLocalReputationList } from '../services/localReputation';
import { ConnectionEvent, NetworkRule, RuleAction, RuleTarget } from '../types';
import { ProtectionProfiles } from '../components/ProtectionProfiles';
import { DeviceIntegrityScans } from '../components/DeviceIntegrityScans';

const actionChoices: { value: RuleAction; label: string }[] = [
  { value: 'allow', label: 'Allow' }, { value: 'block', label: 'Block' },
  { value: 'alert', label: 'Alert' }, { value: 'ignore', label: 'Ignore' },
];
const targetChoices: { value: RuleTarget; label: string }[] = [
  { value: 'domain', label: 'Domain' }, { value: 'ip', label: 'IP address' },
  { value: 'ip-range', label: 'IP range' }, { value: 'asn', label: 'ASN / network' },
  { value: 'country', label: 'Country' }, { value: 'organization', label: 'Organization' },
  { value: 'category', label: 'Category' },
];
const examples: Record<RuleTarget, string> = {
  domain: 'ads.example.com', ip: '203.0.113.42', 'ip-range': '203.0.113.0/24', asn: 'AS15169', country: 'US', organization: 'org-google', category: 'Advertising',
};
const actionHelp: Record<RuleAction, { description: string; example: string }> = {
  allow: { description: 'Save an okay-to-use decision for a familiar destination.', example: 'Allow + api.example.com: see its loaded record count under the saved rule.' },
  block: { description: 'Save a would-block decision. This does not stop a connection.', example: 'Block + ads.example.com: see how many loaded records match.' },
  alert: { description: 'Save a watch-this decision. It does not send a notification.', example: 'Alert + analytics.example.com: see its matches in the rule count.' },
  ignore: { description: 'Save a low-priority decision without deleting any history.', example: 'Ignore + cdn.example.com: its records stay available for review.' },
};
const targetHelp: Record<RuleTarget, { description: string; example: string }> = {
  domain: { description: 'Match one complete domain exactly. Subdomains are separate.', example: 'ads.example.com matches only ads.example.com.' },
  ip: { description: 'Match one IPv4 address recorded for a connection.', example: '203.0.113.42 matches that address only.' },
  'ip-range': { description: 'Match a group of IPv4 addresses using CIDR notation.', example: '203.0.113.0/24 covers addresses from 203.0.113.0 to 203.0.113.255.' },
  asn: { description: 'Match a network number when a record includes one.', example: 'AS15169 matches records labeled with that ASN.' },
  country: { description: 'Match the two-letter destination country code on a record.', example: 'US matches records whose destination country is US.' },
  organization: { description: 'Match one organization identifier from loaded evidence.', example: 'org-google matches records assigned to that organization.' },
  category: { description: 'Match a purpose category such as Advertising or Analytics.', example: 'Advertising matches loaded records classified in that category.' },
};
const durationChoices = [
  { label: 'Permanent', milliseconds: undefined }, { label: '1 hour', milliseconds: 60 * 60_000 },
  { label: '1 day', milliseconds: 24 * 60 * 60_000 }, { label: '1 week', milliseconds: 7 * 24 * 60 * 60_000 },
] as const;
const presetHelp: Record<string, { description: string; example: string }> = {
  'Monitor only': { description: 'Clear the sample domain list and view events without sample domain matches.', example: 'Choose this first, then compare the “Matching sample events” number.' },
  Standard: { description: 'Start with three example ad and attribution domains.', example: 'Choose Standard to see whether sample events contact those domains.' },
  Privacy: { description: 'Add an analytics domain to the Standard examples.', example: 'Choose Privacy to compare its match count with Standard.' },
  Strict: { description: 'Add a second analytics domain to the Privacy examples.', example: 'Choose Strict to see the broadest sample domain match count.' },
  Custom: { description: 'Your current sample domain list differs from the presets.', example: 'Add or remove a domain below, then compare the sample match count.' },
};

function ExampleGuide({ label, description, example }: { label: string; description: string; example: string }) {
  const t = useTheme();
  return <View style={{ marginTop: 14, marginBottom: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.elevated }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.blue }} /><Txt size={10} weight="700" color={t.blue} style={{ letterSpacing: 1.1 }}>{label.toUpperCase()}</Txt></View>
    <Txt size={12} color={t.text} style={{ marginTop: 7 }}>{description}</Txt>
    <Txt size={11} color={t.muted} style={{ marginTop: 6 }}>{example}</Txt>
  </View>;
}

const presetRules: Record<string, string[]> = {
  'Monitor only': [],
  Standard: ['ad.doubleclick.net', 'events.appsflyer.com', 'app.adjust.com'],
  Privacy: ['ad.doubleclick.net', 'events.appsflyer.com', 'app.adjust.com', 'www.google-analytics.com'],
  Strict: ['ad.doubleclick.net', 'events.appsflyer.com', 'app.adjust.com', 'www.google-analytics.com', 'app-measurement.com'],
};
const quickControls = [
  { title: 'Ads', icon: 'shopping-bag' as const, description: 'Ad-serving example domains', domains: ['ad.doubleclick.net'] },
  { title: 'Analytics', icon: 'bar-chart-2' as const, description: 'App and website measurement examples', domains: ['www.google-analytics.com', 'app-measurement.com'] },
  { title: 'Attribution', icon: 'target' as const, description: 'Campaign attribution examples', domains: ['events.appsflyer.com', 'app.adjust.com'] },
];
const simpleActions: { value: RuleAction; title: string; detail: string; icon: 'flag' | 'slash' | 'check' | 'eye-off' }[] = [
  { value: 'alert', title: 'Watch matches', detail: 'Count matches here. No notification is sent.', icon: 'flag' },
  { value: 'block', title: 'Preview a block', detail: 'See what a block rule would match.', icon: 'slash' },
  { value: 'allow', title: 'Mark as okay', detail: 'Save an okay-to-use decision.', icon: 'check' },
  { value: 'ignore', title: 'Lower priority', detail: 'Keep the records, labeled Ignore.', icon: 'eye-off' },
];
const domainPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function ProtectScreen() {
  const t = useTheme();
  const { mode, dataset, range, blockedDomains, toggleDomain, networkRules, addNetworkRule, removeNetworkRule, localReputation, saveLocalReputation, clearLocalReputation, settings, updateSettings, toast, navigate, openDetail } = useApp();
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');
  const [undo, setUndo] = useState<string[] | null>(null);
  const [query, setQuery] = useState('');
  const [ruleAction, setRuleAction] = useState<RuleAction>('alert');
  const [ruleTarget, setRuleTarget] = useState<RuleTarget>('domain');
  const [ruleValue, setRuleValue] = useState('');
  const [ruleDuration, setRuleDuration] = useState<(typeof durationChoices)[number]['label']>('Permanent');
  const [ruleError, setRuleError] = useState('');
  const [destinationSearch, setDestinationSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [simpleAction, setSimpleAction] = useState<RuleAction>('alert');
  const [simpleStatus, setSimpleStatus] = useState('');
  const [reputationBusy, setReputationBusy] = useState(false);
  const [reputationStatus, setReputationStatus] = useState('');
  const [reputationError, setReputationError] = useState('');
  const events = useMemo(() => filterByRange(dataset.connections, range, dataset.generatedAt), [dataset.connections, dataset.generatedAt, range]);
  const recentDestinations = useMemo(() => {
    const byDomain = new Map<string, { event: ConnectionEvent; count: number }>();
    for (const event of events) {
      const value = event.domain.toLowerCase().replace(/\.$/, '');
      const current = byDomain.get(value);
      if (current) {
        current.count += 1;
        if (event.timestamp > current.event.timestamp) current.event = event;
      } else if (normalizeRuleValue('domain', value)) {
        byDomain.set(value, { event, count: 1 });
      }
    }
    return [...byDomain].map(([value, summary]) => ({ domain: value, ...summary })).sort((a, b) => b.event.timestamp - a.event.timestamp);
  }, [events]);
  const appNames = useMemo(() => new Map(dataset.apps.map(app => [app.id, app.name])), [dataset.apps]);
  const organizationNames = useMemo(() => new Map(dataset.organizations.map(organization => [organization.id, organization.name])), [dataset.organizations]);
  const observedOrganizations = useMemo(() => [...new Set(events.map(event => event.organizationId).filter((id): id is string => !!id))].slice(0, 12), [events]);
  const observedCategories = useMemo(() => [...new Set(events.map(event => event.category))].sort(), [events]);
  const searchTerm = destinationSearch.trim().toLowerCase();
  const visibleDestinations = useMemo(() => {
    const found: typeof recentDestinations = [];
    for (const item of recentDestinations) {
      if (!searchTerm || item.domain.includes(searchTerm) || appNames.get(item.event.appId ?? '')?.toLowerCase().includes(searchTerm)) found.push(item);
      if (found.length === 6) break;
    }
    return found;
  }, [appNames, recentDestinations, searchTerm]);
  const chosenDestination = recentDestinations.find(item => item.domain === selectedDomain);
  const matches = events.filter(event => blockedDomains.includes(event.domain.toLowerCase()));
  const legacyRules: NetworkRule[] = blockedDomains.flatMap((value, index) => {
    const normalized = normalizeRuleValue('domain', value);
    return normalized ? [{ id: 'legacy-domain-' + normalized, action: 'block', target: 'domain', value: normalized, createdAt: index } as NetworkRule] : [];
  });
  const allRules = [...legacyRules, ...networkRules];
  const matchedRecords = events.filter(event => evaluateNetworkRules(event, allRules));
  const selectedPreset = Object.keys(presetRules).find(name => presetRules[name].length === blockedDomains.length && presetRules[name].every(item => blockedDomains.includes(item))) ?? 'Custom';
  const applyRules = (domains: string[], label: string) => {
    setUndo([...blockedDomains]);
    [...new Set([...blockedDomains, ...domains])].forEach(item => { if (blockedDomains.includes(item) !== domains.includes(item)) toggleDomain(item); });
    toast(`${label} saved locally. No device traffic is blocked.`);
  };
  const addAdvancedRule = () => {
    const duration = durationChoices.find(choice => choice.label === ruleDuration)?.milliseconds;
    const rule = createNetworkRule(ruleAction, ruleTarget, ruleValue, Date.now(), duration);
    if (!rule) {
      setRuleError(ruleTarget === 'country' ? 'Enter a two-letter country code, such as US.' : ruleTarget === 'asn' ? 'Enter an ASN such as AS15169.' : ruleTarget === 'ip-range' ? 'Enter an IPv4 range in CIDR form, such as 203.0.113.0/24.' : ruleTarget === 'ip' ? 'Enter a valid IPv4 address.' : ruleTarget === 'organization' ? 'Enter an organization identifier shown in loaded evidence.' : ruleTarget === 'category' ? 'Enter a supported category such as Advertising, Analytics, Attribution, Marketing, Telemetry, Cloud, or Unknown.' : 'Enter a complete domain, without a URL or path.');
      return;
    }
    addNetworkRule(rule);
    setRuleValue('');
    setRuleError('');
    toast('Local rule saved. It only evaluates records already available to IPward.');
  };
  const saveSimpleRule = () => {
    if (!chosenDestination) return;
    const rule = createNetworkRule(simpleAction, 'domain', chosenDestination.domain);
    if (!rule) return;
    networkRules.filter(item => item.target === 'domain' && item.value === rule.value).forEach(item => removeNetworkRule(item.id));
    addNetworkRule(rule);
    const label = simpleActions.find(action => action.value === simpleAction)?.title ?? 'Decision';
    setSimpleStatus(`${label} saved for ${rule.value}. ${chosenDestination.count} records match in this view.`);
    toast('Local decision saved. No device traffic was changed.');
  };
  const importLocalReputation = async () => {
    setReputationStatus(''); setReputationError(''); setReputationBusy(true);
    let pickedUri: string | null = null;
    try {
      const selection = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false, base64: false });
      if (selection.canceled) return;
      const asset = selection.assets[0];
      pickedUri = asset.uri;
      if (asset.size && asset.size > MAX_REPUTATION_LIST_BYTES) throw new Error('This list exceeds the 5 MB import limit.');
      const contents = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
      const parsed = parseLocalReputationList(contents);
      saveLocalReputation({ name: asset.name.slice(0, 200) || 'Imported list', importedAt: Date.now(), domains: parsed.domains, source: 'user-import' });
      setReputationStatus(`Imported ${parsed.domains.length.toLocaleString()} exact domains locally.${parsed.skipped ? ` ${parsed.skipped.toLocaleString()} lines were skipped.` : ''}`);
      toast('Local reputation list imported. No domain lookups were sent.');
    } catch (caught) {
      setReputationError(caught instanceof Error ? caught.message : 'The local list could not be imported.');
    } finally {
      if (Platform.OS !== 'web' && pickedUri?.startsWith(Paths.cache.uri)) {
        try { new File(pickedUri).delete(); } catch { /* OS cache cleanup remains available. */ }
      }
      setReputationBusy(false);
    }
  };
  const addDomain = () => {
    const value = domain.trim().toLowerCase();
    if (!domainPattern.test(value) || value.includes('..')) { setError('Enter a complete domain such as analytics.example.com. Leave out https://, paths, wildcards, and IP addresses.'); return; }
    if (blockedDomains.includes(value)) { setError('That domain already has a sample rule.'); return; }
    applyRules([...blockedDomains, value], 'Sample rule'); setDomain(''); setError('');
  };
  return <View style={styles.stack}>
    <Card style={{ backgroundColor: t.blueTint, borderColor: t.blueTint }}>
      <View style={{ ...styles.row, alignItems: 'flex-start' }}><View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface }}><Icon name="sliders" color={t.blue} size={21} /></View><View style={{ flex: 1 }}><Txt size={18} weight="600">Your rules. Your control.</Txt><Txt color={t.muted} size={13} style={{ marginTop: 5 }}>Explore how domain rules would affect sample activity. Network filtering is unavailable in this build.</Txt><View style={{ marginTop: 8 }}><Badge state="Unavailable" /></View></View></View>
    </Card>
    <Card style={{ borderColor: t.cyan }}>
      <View style={{ ...styles.row, alignItems: 'flex-start' }}><View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: t.cyanTint, alignItems: 'center', justifyContent: 'center' }}><Icon name="shield" color={t.cyan} size={20}/></View><View style={{ flex: 1 }}><Txt size={16} weight="600">Device security</Txt><Txt size={12} color={t.muted} style={{ marginTop: 4, lineHeight: 18 }}>Review available evidence, compare threat indicators, check phone timing, and test internet speed with a clear data limit.</Txt><View style={{ alignSelf: 'flex-start', marginTop: 14 }}><Button label="Open Security Center" icon="arrow-up-right" variant="secondary" onPress={() => navigate('Security')}/></View></View></View>
    </Card>
    <DeviceIntegrityScans/>
    <Card><ProtectionProfiles/></Card>
    <View style={styles.wrap}><Metric label="Sample domain rules" value={blockedDomains.length} icon="list" detail="Saved on this device" /><Metric label="Matching sample events" value={mode === 'demo' ? matches.length.toLocaleString() : '—'} icon="filter" state={mode === 'demo' ? 'Observed' : 'Unavailable'} detail={mode === 'demo' ? `${range} · Domain matches only` : 'No device observation source'} /><Metric label="Traffic blocked" value="—" icon="slash" state="Unavailable" detail="No active filtering service" /></View>
    <Card>
      <SectionHeading title="Quick domain controls" subtitle="Simple switches for the sample rules below" />
      <Txt size={12} color={t.muted} style={{ marginBottom: 10 }}>Turn a group on to add its exact domains to your saved sample rules. Turn it off to remove those domains. Presets and custom rules remain available below.</Txt>
      {quickControls.map((control, index) => {
        const selected = control.domains.filter(item => blockedDomains.includes(item)).length;
        const enabled = selected === control.domains.length;
        const count = events.filter(event => control.domains.includes(event.domain.toLowerCase())).length;
        return <View key={control.title} style={{ ...styles.row, paddingVertical: 14, borderTopWidth: index ? 1 : 0, borderColor: t.border }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: enabled ? t.blueTint : t.elevated }}><Icon name={control.icon} size={17} color={enabled ? t.blue : t.muted} /></View>
          <View style={{ flex: 1 }}>
            <Txt size={14} weight="600">{control.title}</Txt>
            <Txt size={11} color={t.muted}>{control.description}</Txt>
            <Txt size={10} color={t.subtle} style={{ marginTop: 3 }}>{selected} of {control.domains.length} domains selected · {count} {mode === 'demo' ? 'sample' : 'loaded'} events in view</Txt>
          </View>
          <Switch accessibilityLabel={`${control.title} sample domain rules`} accessibilityHint={`Adds or removes the ${control.title.toLowerCase()} example domains from saved sample rules. Does not block traffic.`} value={enabled} onValueChange={value => applyRules(value ? [...blockedDomains, ...control.domains] : blockedDomains.filter(item => !control.domains.includes(item)), `${control.title} quick control`)} trackColor={{ false: t.border, true: t.blue }} thumbColor={t.surface} />
        </View>;
      })}
      <InfoNote>These switches organize local rule previews. They do not block connections or change device settings.</InfoNote>
    </Card>
    <Card>
      <SectionHeading title="Make a rule without typing" subtitle="Choose a destination already in this view" />
      <Txt size={12} weight="600" style={{ marginBottom: 8 }}>1. Pick a destination</Txt>
      <TextInput accessibilityLabel="Search destinations for a simple rule" value={destinationSearch} onChangeText={value => { setDestinationSearch(value); setSelectedDomain(''); setSimpleStatus(''); }} autoCapitalize="none" autoCorrect={false} placeholder="Search a website or app" placeholderTextColor={t.subtle} style={{ color: t.text, backgroundColor: t.background, minHeight: 47, paddingHorizontal: 14, borderWidth: 1, borderColor: t.border, borderRadius: 10, fontSize: 13 }} />
      <View style={{ gap: 8, marginTop: 12 }}>
        {visibleDestinations.map(item => {
          const selected = selectedDomain === item.domain;
          const appName = appNames.get(item.event.appId ?? '') ?? 'Unattributed app';
          return <Pressable key={item.domain} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${item.domain}, last seen with ${appName}, ${item.count} records in total`} onPress={() => { setSelectedDomain(item.domain); setSimpleStatus(''); }} style={({ pressed }) => ({ minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: selected ? t.blue : t.border, backgroundColor: selected ? t.blueTint : pressed ? t.elevated : t.surface })}>
            <Icon name={selected ? 'check-circle' : 'globe'} color={selected ? t.blue : t.muted} size={18} />
            <View style={{ flex: 1 }}><Txt size={12} weight="600" numberOfLines={2}>{item.domain}</Txt><Txt size={10} color={t.muted}>Last seen with {appName} · {item.count} {mode === 'demo' ? 'sample' : 'loaded'} records total</Txt></View>
          </Pressable>;
        })}
        {!recentDestinations.length && <Txt size={12} color={t.muted}>No destinations are loaded in this view. You can still use the custom rule form below.</Txt>}
        {!!recentDestinations.length && !visibleDestinations.length && <Txt size={12} color={t.muted}>No destinations match that search.</Txt>}
      </View>
      <Txt size={12} weight="600" style={{ marginTop: 20, marginBottom: 9 }}>2. Choose what the rule means</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        {simpleActions.map(action => {
          const selected = simpleAction === action.value;
          return <Pressable key={action.value} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={action.title} accessibilityHint={action.detail} onPress={() => { setSimpleAction(action.value); setSimpleStatus(''); }} style={({ pressed }) => ({ flexGrow: 1, flexBasis: 125, minHeight: 88, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: selected ? t.blue : t.border, backgroundColor: selected ? t.blueTint : pressed ? t.elevated : t.surface })}>
            <View style={{ ...styles.row, gap: 7 }}><Icon name={action.icon} color={selected ? t.blue : t.muted} size={15} /><Txt size={12} weight="600" color={selected ? t.blue : t.text} style={{ flex: 1 }}>{action.title}</Txt></View>
            <Txt size={10} color={t.muted} style={{ marginTop: 6 }}>{action.detail}</Txt>
          </Pressable>;
        })}
      </View>
      {chosenDestination && <View style={{ marginTop: 15, padding: 12, borderRadius: 10, backgroundColor: t.elevated }}><Txt size={11} color={t.muted}>This choice will label {chosenDestination.count} {mode === 'demo' ? 'sample' : 'loaded'} records for {chosenDestination.domain}. It will not change traffic.</Txt>{blockedDomains.includes(chosenDestination.domain) && <Txt size={10} color={t.muted} style={{ marginTop: 5 }}>This domain is also in the sample rule list. Your new exact-domain decision will take priority in the rule view.</Txt>}</View>}
      <View style={{ alignSelf: 'flex-start', marginTop: 15 }}><Button label="Save this choice" icon="check" disabled={!chosenDestination} onPress={saveSimpleRule} /></View>
      {!!simpleStatus && <Txt accessibilityLiveRegion="polite" size={11} color={t.cyan} style={{ marginTop: 10 }}>{simpleStatus}</Txt>}
      <InfoNote>Saved decisions are shown in Rule actions below. They only evaluate records IPward already has. Watch matches does not send a notification, and Preview a block does not block connections.</InfoNote>
    </Card>
    <Card>
      <SectionHeading title="Rule presets" subtitle="Changes the local sample rule list" />
      <Txt size={12} color={t.muted} style={{ marginBottom: 12 }}>Tap a preset to see when to use it, then compare the sample match count above.</Txt>
      <View style={styles.wrap}>{Object.keys(presetRules).map(name => <Pill key={name} label={name} active={selectedPreset === name} onPress={() => applyRules(presetRules[name], `${name} preset`)} />)}{selectedPreset === 'Custom' && <Pill label="Custom" active onPress={() => undefined} />}</View>
      <ExampleGuide label={`${selectedPreset} example`} description={presetHelp[selectedPreset].description} example={presetHelp[selectedPreset].example} />
      <InfoNote>Real domain blocking can break sign-in, content delivery, and other app features. These controls only simulate matches; they do not enable protection.</InfoNote>
    </Card>
    <Card>
      <SectionHeading title="Custom domain rules" subtitle="Exact domains only · No subdomain or IP matching" />
      <ExampleGuide label="Try an exact domain" description="Type a complete domain, then tap Add rule. The number below each saved domain shows its sample matches." example="Try analytics.example.com. It will not match shop.analytics.example.com." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}><TextInput accessibilityLabel="Domain for sample rule" value={domain} onChangeText={value => { setDomain(value); setError(''); }} onSubmitEditing={addDomain} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="analytics.example.com" placeholderTextColor={t.subtle} style={{ color: t.text, backgroundColor: t.background, minHeight: 47, paddingHorizontal: 14, flex: 1, minWidth: 170, borderWidth: 1, borderColor: error ? t.red : t.border, borderRadius: 10, fontSize: 13 }} /><Button label="Add rule" icon="plus" onPress={addDomain} /></View>
      {!!error && <Txt accessibilityRole="alert" color={t.red} size={12} style={{ marginTop: 10 }}>{error}</Txt>}
      {undo !== null && <View style={{ ...styles.between, marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: t.elevated }}><Txt size={12} color={t.muted} style={{ flex: 1 }}>Sample rules updated locally.</Txt><Button label="Undo" icon="rotate-ccw" variant="ghost" small onPress={() => { const previous = undo; applyRules(previous, 'Previous rules'); setUndo(null); }} /></View>}
      {blockedDomains.length > 4 && <TextInput accessibilityLabel="Search sample rules" placeholder="Search rules" placeholderTextColor={t.subtle} value={query} onChangeText={setQuery} style={{ minHeight: 45, color: t.text, marginTop: 12, borderBottomWidth: 1, borderColor: t.border }} />}
      <View style={{ marginTop: 19 }}>
        {blockedDomains.filter(item => item.includes(query.toLowerCase())).map(item => <View key={item} style={{ ...styles.row, paddingVertical: 14, borderTopWidth: 1, borderColor: t.border }}><Icon name="globe" color={t.blue} size={17} /><View style={{ flex: 1 }}><Txt size={13}>{item}</Txt><Txt size={11} color={t.muted}>{mode === 'demo' ? `${events.filter(event => event.domain === item).length} matching sample events` : 'Match simulation unavailable in device mode'}</Txt></View><Button label="Remove" small variant="ghost" onPress={() => applyRules(blockedDomains.filter(rule => rule !== item), 'Rule removal')} /></View>)}
        {!blockedDomains.length && <View style={{ alignItems: 'center', gap: 8, paddingVertical: 20 }}><Icon name="list" size={24} /><Txt size={14}>No sample rules yet</Txt><Txt color={t.muted} size={12}>Choose a preset or add a complete domain.</Txt></View>}
        {!!blockedDomains.length && !blockedDomains.some(item => item.includes(query.toLowerCase())) && <Txt size={12} color={t.muted}>No rules match your search.</Txt>}
      </View>
    </Card>
    <Card>
      <SectionHeading title="Rule actions" subtitle="Apply local decisions to records IPward already has" />
      <Txt size={12} color={t.muted} style={{ marginBottom: 10 }}>Choose an action, choose what to match, and enter a value. Tap any option to see what it means.</Txt>
      <Txt size={10} color={t.subtle} weight="700" style={{ letterSpacing: 1.2, marginBottom: 8 }}>ACTION</Txt>
      <View style={styles.wrap}>{actionChoices.map(choice => <Pill key={choice.value} label={choice.label} active={ruleAction === choice.value} onPress={() => setRuleAction(choice.value)} />)}</View>
      <ExampleGuide label={`${ruleAction} means`} description={actionHelp[ruleAction].description} example={actionHelp[ruleAction].example} />
      <Txt size={10} color={t.subtle} weight="700" style={{ letterSpacing: 1.2, marginTop: 16, marginBottom: 8 }}>MATCH BY</Txt>
      <View style={styles.wrap}>{targetChoices.map(choice => <Pill key={choice.value} label={choice.label} active={ruleTarget === choice.value} onPress={() => { setRuleTarget(choice.value); setRuleValue(''); setRuleError(''); }} />)}</View>
      {ruleTarget === 'organization' && !!observedOrganizations.length && <View style={{ marginTop: 13 }}><Txt size={10} color={t.muted}>CHOOSE FROM LOADED EVIDENCE</Txt><View style={{ ...styles.wrap, marginTop: 7 }}>{observedOrganizations.map(id => <Pill key={id} label={organizationNames.get(id) ?? id} active={ruleValue === id} onPress={() => { setRuleValue(id); setRuleError(''); }}/>)}</View></View>}
      {ruleTarget === 'category' && !!observedCategories.length && <View style={{ marginTop: 13 }}><Txt size={10} color={t.muted}>CHOOSE FROM LOADED EVIDENCE</Txt><View style={{ ...styles.wrap, marginTop: 7 }}>{observedCategories.map(category => <Pill key={category} label={category} active={ruleValue.toLowerCase() === category.toLowerCase()} onPress={() => { setRuleValue(category); setRuleError(''); }}/>)}</View></View>}
      <ExampleGuide label={`${targetChoices.find(choice => choice.value === ruleTarget)?.label} example`} description={targetHelp[ruleTarget].description} example={targetHelp[ruleTarget].example} />
      <Txt size={10} color={t.subtle} weight="700" style={{ letterSpacing: 1.2, marginTop: 16, marginBottom: 8 }}>DURATION</Txt>
      <View style={styles.wrap}>{durationChoices.map(choice => <Pill key={choice.label} label={choice.label} active={ruleDuration === choice.label} onPress={() => setRuleDuration(choice.label)}/>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 16 }}>
        <TextInput accessibilityLabel={ruleTarget + ' rule value'} value={ruleValue} onChangeText={value => { setRuleValue(value); setRuleError(''); }} onSubmitEditing={addAdvancedRule} autoCapitalize="none" autoCorrect={false} keyboardType={ruleTarget === 'ip' || ruleTarget === 'ip-range' ? 'numbers-and-punctuation' : 'default'} placeholder={examples[ruleTarget]} placeholderTextColor={t.subtle} style={{ color: t.text, backgroundColor: t.background, minHeight: 47, paddingHorizontal: 14, flex: 1, minWidth: 170, borderWidth: 1, borderColor: ruleError ? t.red : t.border, borderRadius: 10, fontSize: 13 }} />
        <Button label="Add rule" icon="plus" onPress={addAdvancedRule} />
      </View>
      <View style={{ alignSelf: 'flex-start', marginTop: 8 }}><Button label={`Use ${examples[ruleTarget]} example`} variant="ghost" small onPress={() => { setRuleValue(examples[ruleTarget]); setRuleError(''); }} /></View>
      {!!ruleError && <Txt accessibilityRole="alert" color={t.red} size={12} style={{ marginTop: 10 }}>{ruleError}</Txt>}
      <InfoNote>These rules run against loaded records only; they do not change traffic. Expired temporary rules stop matching automatically. If two rules match, the more specific target wins; an exact domain or IP outranks a category or country rule.</InfoNote>
      <View style={{ marginTop: 10 }}>
        {!networkRules.length && <Txt size={12} color={t.muted}>No advanced rules saved.</Txt>}
        {networkRules.map(rule => {
          const count = events.filter(event => evaluateNetworkRules(event, allRules)?.id === rule.id).length;
          const color = rule.action === 'block' ? t.red : rule.action === 'alert' ? t.amber : rule.action === 'allow' ? t.cyan : t.muted;
          return <View key={rule.id} style={{ ...styles.row, paddingVertical: 13, borderTopWidth: 1, borderColor: t.border }}>
            <View style={{ minWidth: 56, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, backgroundColor: color + '22' }}><Txt size={10} color={color} weight="700">{rule.action.toUpperCase()}</Txt></View>
            <View style={{ flex: 1 }}><Txt size={12} weight="500">{rule.value}</Txt><Txt size={10} color={t.muted}>{rule.target} · {count} matching {mode === 'demo' ? 'sample ' : ''}records {mode === 'device' ? 'in this view' : 'in this range'}{rule.expiresAt ? ` · expires ${new Date(rule.expiresAt).toLocaleString()}` : ''}</Txt></View>
            <Button label="Remove" small variant="ghost" onPress={() => removeNetworkRule(rule.id)} />
          </View>;
        })}
      </View>
      <Txt accessibilityLiveRegion="polite" size={11} color={t.muted} style={{ marginTop: 6 }}>{`${matchedRecords.length} records match at least one rule in the current view.`}</Txt>
    </Card>
    <Card>
      <SectionHeading title="Local reputation list" subtitle="Optional exact-domain checks, stored on this device" />
      <Txt size={12} color={t.muted}>Import a plain domain list or hosts file. IPward checks loaded records against it on-device. A match only means the domain appears in your file; its source and threat type are not independently verified. Nothing is sent to a reputation service.</Txt>
      <ExampleGuide label="Try a local list" description="Make a text file with one domain per line, then tap Import a list. Matching loaded records appear below for inspection." example={'ads.example.com\nmetrics.example.org'} />
      {localReputation ? <>
        <View style={{ ...styles.between, padding: 12, borderRadius: 10, backgroundColor: t.elevated }}>
          <View style={{ flex: 1, paddingRight: 8 }}><Txt size={13} weight="600" numberOfLines={1}>{localReputation.name}</Txt><Txt size={11} color={t.muted} style={{ marginTop: 4 }}>{localReputation.domains.length.toLocaleString()} domains · Imported {new Date(localReputation.importedAt).toLocaleString()}</Txt></View>
          <Button label="Clear list" small variant="ghost" onPress={() => { clearLocalReputation(); setReputationStatus('Local reputation list removed.'); }} />
        </View>
        {(() => {
          const listed = new Set(localReputation.domains);
          const matched = events.filter(event => listed.has(event.domain.toLowerCase().replace(/\.$/, '')));
          const unique = [...new Map(matched.map(event => [event.domain.toLowerCase(), event])).values()].slice(0, 6);
          return <View style={{ marginTop: 14 }}>
            <Txt size={12} color={t.muted} accessibilityLiveRegion="polite">{matched.length} exact matches in the current {mode === 'demo' ? 'sample' : 'loaded'} view</Txt>
            {unique.map(event => <View key={event.domain} style={{ ...styles.between, paddingVertical: 11, borderTopWidth: 1, borderColor: t.border }}><View style={{ flex: 1 }}><Txt size={12} weight="500">{event.domain}</Txt><Txt size={10} color={t.muted}>Listed in your local file · {new Date(event.timestamp).toLocaleString()}</Txt></View><Button label="Inspect" small variant="ghost" onPress={() => openDetail({ type: 'connection', id: event.id })} /></View>)}
            {matched.length > unique.length && <Txt size={11} color={t.muted}>Showing {unique.length} of {matched.length} matching records.</Txt>}
            {!matched.length && <Txt size={11} color={t.muted} style={{ marginTop: 7 }}>No current records exactly match this list.</Txt>}
          </View>;
        })()}
      </> : <Txt size={12} color={t.muted} style={{ marginBottom: 12 }}>No local reputation list installed.</Txt>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 13 }}><Button label={reputationBusy ? 'Importing…' : localReputation ? 'Replace list' : 'Import a list'} icon="upload" variant="secondary" disabled={reputationBusy} onPress={() => void importLocalReputation()} /><Txt size={11} color={t.muted}>Plain domains or hosts file · 5 MB maximum</Txt></View>
      {!!reputationStatus && <Txt accessibilityLiveRegion="polite" size={11} color={t.cyan} style={{ marginTop: 10 }}>{reputationStatus}</Txt>}
      {!!reputationError && <Txt accessibilityRole="alert" size={11} color={t.red} style={{ marginTop: 10 }}>{reputationError}</Txt>}
    </Card>
    <Card><SectionHeading title="Privacy preferences" subtitle="Stored locally and remembered between sessions" /><View style={{ ...styles.row, paddingVertical: 12 }}><Icon name="bell" /><View style={{ flex: 1 }}><Txt size={14}>Activity notices</Txt><Txt size={12} color={t.muted}>Show first-seen report notices and sample activity callouts.</Txt><Txt size={11} color={t.subtle} style={{ marginTop: 4 }}>Example: after you import a report, a newly seen domain can appear in Alerts.</Txt></View><Switch accessibilityLabel="Activity notices" value={settings.alerts} onValueChange={value => updateSettings({ alerts: value })} trackColor={{ false: t.border, true: t.blue }} thumbColor={t.surface} /></View><View style={{ ...styles.row, paddingVertical: 17, borderTopWidth: 1, borderColor: t.border }}><Icon name="hard-drive" color={t.cyan} /><View style={{ flex: 1 }}><Txt size={14}>Local processing</Txt><Txt size={12} color={t.muted}>Rules and preferences stay in app storage.</Txt><Txt size={11} color={t.subtle} style={{ marginTop: 4 }}>Example: your saved rules and imported list stay on this device.</Txt></View><Txt color={t.cyan} size={12}>Active</Txt></View><Button label="Trust & transparency" variant="secondary" icon="arrow-up-right" onPress={() => navigate('Trust')} /></Card>
  </View>;
}
