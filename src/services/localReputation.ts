import { LocalReputationList } from '../types';
import { normalizeRuleValue } from './networkRules';

export const MAX_REPUTATION_LIST_BYTES = 5_000_000;
export const MAX_REPUTATION_DOMAINS = 20_000;
const MAX_REPUTATION_LINES = 100_000;

export interface ParsedReputationList { domains: string[]; skipped: number }

/** Parse a user-selected plain domain or hosts file without trusting its labels. */
export function parseLocalReputationList(text: string): ParsedReputationList {
  if (text.length > MAX_REPUTATION_LIST_BYTES) throw new Error('This list exceeds the 5 MB import limit.');
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length > MAX_REPUTATION_LINES) throw new Error('This list has too many lines to import safely.');
  const domains = new Set<string>();
  let skipped = 0;
  for (const line of lines) {
    const content = line.split('#', 1)[0].trim();
    if (!content || content.startsWith('!') || content.startsWith(';')) continue;
    const fields = content.split(/\s+/);
    const isHostsRow = normalizeRuleValue('ip', fields[0]) !== null;
    const candidates = isHostsRow ? fields.slice(1) : [fields[0]];
    let accepted = false;
    for (const candidate of candidates) {
      const domain = normalizeRuleValue('domain', candidate);
      if (!domain) continue;
      accepted = true;
      domains.add(domain);
      if (domains.size > MAX_REPUTATION_DOMAINS) throw new Error('This list contains more than 20,000 unique domains.');
    }
    if (!accepted) skipped++;
  }
  if (!domains.size) throw new Error('No valid domains were found. Use one domain per line or a standard hosts file.');
  return { domains: [...domains].sort(), skipped };
}

export function isStoredLocalReputation(value: unknown): value is LocalReputationList {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const list = value as Partial<LocalReputationList>;
  return typeof list.name === 'string' && list.name.length > 0 && list.name.length <= 200
    && typeof list.importedAt === 'number' && Number.isFinite(list.importedAt) && list.importedAt >= 0
    && list.importedAt <= Date.now() + 86_400_000
    && list.source === 'user-import'
    && Array.isArray(list.domains) && list.domains.length > 0 && list.domains.length <= MAX_REPUTATION_DOMAINS
    && list.domains.every(domain => typeof domain === 'string' && normalizeRuleValue('domain', domain) === domain);
}
