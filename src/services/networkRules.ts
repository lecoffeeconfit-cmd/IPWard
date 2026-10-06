import { ConnectionEvent, NetworkRule, RuleAction, RuleTarget } from '../types';

const domainPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const ipv4Pattern = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function ipv4Number(value: string): number | null {
  if (!ipv4Pattern.test(value)) return null;
  const octets = value.split('.').map(Number);
  if (octets.some(octet => octet < 0 || octet > 255)) return null;
  return (octets[0] * 0x1000000 + octets[1] * 0x10000 + octets[2] * 0x100 + octets[3]) >>> 0;
}

function ipv4Text(value: number): string {
  return [value >>> 24, value >>> 16 & 255, value >>> 8 & 255, value & 255].join('.');
}

/** Return a canonical value or null when the selected target is malformed. */
export function normalizeRuleValue(target: RuleTarget, raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (target === 'domain') {
    const domain = value.toLowerCase().replace(/\.$/, '');
    return domainPattern.test(domain) && !domain.includes('..') ? domain : null;
  }
  if (target === 'ip') {
    const address = ipv4Number(value);
    return address === null ? null : ipv4Text(address);
  }
  if (target === 'ip-range') {
    const match = /^(.+)\/(\d{1,2})$/.exec(value);
    if (!match) return null;
    const address = ipv4Number(match[1]);
    const prefix = Number(match[2]);
    if (address === null || prefix > 32) return null;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return ipv4Text((address & mask) >>> 0) + '/' + prefix;
  }
  if (target === 'asn') {
    const asn = value.toUpperCase();
    return /^AS\d{1,10}$/.test(asn) ? asn : null;
  }
  if (target === 'country') {
    const country = value.toUpperCase();
    return /^[A-Z]{2}$/.test(country) ? country : null;
  }
  if (target === 'organization') return /^[a-z0-9][a-z0-9:._-]{0,119}$/i.test(value) ? value : null;
  if (target === 'category') {
    const category = value.toLowerCase();
    const allowed = ['app service', 'cdn', 'authentication', 'cloud', 'analytics', 'advertising', 'attribution', 'marketing', 'telemetry', 'crash reporting', 'communication', 'unknown'];
    return allowed.includes(category) ? category : null;
  }
  return null;
}

export function isStoredNetworkRule(value: unknown): value is NetworkRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rule = value as Partial<NetworkRule>;
  return typeof rule.id === 'string' && rule.id.length > 0 && rule.id.length <= 100
    && ['allow', 'block', 'alert', 'ignore'].includes(String(rule.action))
    && ['domain', 'ip', 'ip-range', 'asn', 'country', 'organization', 'category'].includes(String(rule.target))
    && typeof rule.value === 'string' && normalizeRuleValue(rule.target as RuleTarget, rule.value) === rule.value
    && typeof rule.createdAt === 'number' && Number.isFinite(rule.createdAt) && rule.createdAt >= 0
    && (rule.expiresAt === undefined || (typeof rule.expiresAt === 'number' && Number.isFinite(rule.expiresAt) && rule.expiresAt > rule.createdAt));
}

export function createNetworkRule(action: RuleAction, target: RuleTarget, rawValue: string, now = Date.now(), durationMs?: number): NetworkRule | null {
  const value = normalizeRuleValue(target, rawValue);
  if (!value || !Number.isFinite(now) || now < 0 || (durationMs !== undefined && (!Number.isFinite(durationMs) || durationMs <= 0))) return null;
  return { id: 'rule-' + now + '-' + Math.random().toString(36).slice(2, 8), action, target, value, createdAt: now, ...(durationMs ? { expiresAt: now + durationMs } : {}) };
}

function ruleMatches(rule: NetworkRule, event: ConnectionEvent): boolean {
  if (rule.target === 'domain') return event.domain.toLowerCase().replace(/\.$/, '') === rule.value;
  if (rule.target === 'ip') return event.ip === rule.value;
  if (rule.target === 'asn') return event.asn.toUpperCase() === rule.value;
  if (rule.target === 'country') return event.countryCode.toUpperCase() === rule.value;
  if (rule.target === 'organization') return event.organizationId === rule.value;
  if (rule.target === 'category') return event.category.toLowerCase() === rule.value;
  const [networkText, prefixText] = rule.value.split('/');
  const address = ipv4Number(event.ip);
  const network = ipv4Number(networkText);
  if (address === null || network === null) return false;
  const prefix = Number(prefixText);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return ((address & mask) >>> 0) === ((network & mask) >>> 0);
}

const specificity: Record<RuleTarget, number> = { domain: 6, ip: 6, 'ip-range': 5, organization: 4, asn: 3, country: 2, category: 1 };

/** Most specific matching rule wins; the newest rule wins a specificity tie. */
export function evaluateNetworkRules(event: ConnectionEvent, rules: readonly NetworkRule[], now = Date.now()): NetworkRule | null {
  return rules.filter(rule => (!rule.expiresAt || rule.expiresAt > now) && ruleMatches(rule, event)).sort((a, b) => specificity[b.target] - specificity[a.target] || b.createdAt - a.createdAt)[0] ?? null;
}
