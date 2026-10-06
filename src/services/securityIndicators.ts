import { normalizeRuleValue } from './networkRules';
import { utf8ByteLength } from '../utils/export';

export const MAX_SECURITY_INDICATOR_BYTES = 5_000_000;
const MAX_INDICATORS = 10_000;

/** Only the indicator types that IPward can compare with currently loaded records. */
export interface SecurityIndicatorSet {
  name: string;
  importedAt: number;
  source: 'user-import';
  domains: string[];
  ips: string[];
  appIds: string[];
  skipped: number;
}

export function parseSecurityIndicators(text: string, name: string, now = Date.now()): SecurityIndicatorSet {
  if (utf8ByteLength(text) > MAX_SECURITY_INDICATOR_BYTES) throw new Error('This indicator file exceeds the 5 MB import limit.');
  let parsed: unknown;
  try { parsed = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('Choose a valid STIX2 JSON bundle.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Choose a STIX2 bundle containing indicator objects.');
  const bundle = parsed as { type?: unknown; objects?: unknown };
  if (bundle.type !== 'bundle' || !Array.isArray(bundle.objects)) throw new Error('Choose a STIX2 bundle containing indicator objects.');
  if (bundle.objects.length > 100_000) throw new Error('This indicator file has too many objects to import safely.');

  const domains = new Set<string>();
  const ips = new Set<string>();
  const appIds = new Set<string>();
  let skipped = 0;
  for (const object of bundle.objects) {
    if (!object || typeof object !== 'object' || Array.isArray(object)) continue;
    const item = object as { type?: unknown; pattern?: unknown; revoked?: unknown; valid_from?: unknown; valid_until?: unknown };
    if (item.type !== 'indicator') continue;
    const starts = typeof item.valid_from === 'string' ? Date.parse(item.valid_from) : null;
    const ends = typeof item.valid_until === 'string' ? Date.parse(item.valid_until) : null;
    if (item.revoked === true || starts !== null && (!Number.isFinite(starts) || starts > now)
      || ends !== null && (!Number.isFinite(ends) || ends <= now)) { skipped++; continue; }
    if (typeof item.pattern !== 'string' || item.pattern.length > 1000) { skipped++; continue; }
    // Deliberately exclude URL, file, process and profile patterns: a domain or app ID
    // alone cannot prove that a path-specific or inaccessible artifact matched.
    const match = /^\[\s*(domain-name:value|ipv4-addr:value|app:id)\s*=\s*(['"])([^'"\\]{1,253})\2\s*\]$/i.exec(item.pattern);
    if (!match) { skipped++; continue; }
    const kind = match[1].toLowerCase();
    const raw = match[3];
    if (kind === 'domain-name:value') {
      const domain = normalizeRuleValue('domain', raw);
      if (domain) domains.add(domain); else skipped++;
    } else if (kind === 'ipv4-addr:value') {
      const ip = normalizeRuleValue('ip', raw);
      if (ip) ips.add(ip); else skipped++;
    } else {
      if (/^[a-z0-9][a-z0-9._-]{2,199}$/i.test(raw)) appIds.add(raw.toLowerCase()); else skipped++;
    }
    if (domains.size + ips.size + appIds.size > MAX_INDICATORS) throw new Error('This file contains more than 10,000 supported indicators.');
  }
  if (!domains.size && !ips.size && !appIds.size) throw new Error('No supported exact domain, IPv4 address, or app ID indicators were found.');
  return { name: name.trim().slice(0, 200) || 'Imported STIX2 file', importedAt: now, source: 'user-import', domains: [...domains].sort(), ips: [...ips].sort(), appIds: [...appIds].sort(), skipped };
}

export function isStoredSecurityIndicators(value: unknown): value is SecurityIndicatorSet {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const set = value as Partial<SecurityIndicatorSet>;
  if (typeof set.name !== 'string' || !set.name || set.name.length > 200 || set.source !== 'user-import'
    || typeof set.importedAt !== 'number' || !Number.isFinite(set.importedAt) || set.importedAt < 0 || set.importedAt > Date.now() + 86_400_000
    || typeof set.skipped !== 'number' || !Number.isInteger(set.skipped) || set.skipped < 0) return false;
  if (!Array.isArray(set.domains) || !Array.isArray(set.ips) || !Array.isArray(set.appIds)
    || set.domains.length + set.ips.length + set.appIds.length === 0
    || set.domains.length + set.ips.length + set.appIds.length > MAX_INDICATORS) return false;
  return set.domains.every(domain => typeof domain === 'string' && normalizeRuleValue('domain', domain) === domain)
    && set.ips.every(ip => typeof ip === 'string' && normalizeRuleValue('ip', ip) === ip)
    && set.appIds.every(id => typeof id === 'string' && /^[a-z0-9][a-z0-9._-]{2,199}$/.test(id));
}
