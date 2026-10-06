import { DataFootprintCategorySummary, DataFootprintImport, FootprintCategory } from '../types';

export const MAX_FOOTPRINT_EXPORT_BYTES = 12_000_000;
const MAX_FIELDS = 100_000;
const MAX_DEPTH = 12;

const categoryPatterns: { category: FootprintCategory; patterns: RegExp[] }[] = [
  { category: 'Identity & account', patterns: [/\b(name|email|phone|username|profile|account|birthday|birthdate|gender|address)\b/i] },
  { category: 'Location', patterns: [/\b(location|latitude|longitude|place|gps|geolocation|geotag|checkin)\b/i] },
  { category: 'Browsing & search', patterns: [/\b(search|query|browser|browsing|website|webpage|url|visited|history)\b/i] },
  { category: 'App activity', patterns: [/\b(activity|event|session|feature|usage|watch|viewed|played|interaction)\b/i] },
  { category: 'Purchases & subscriptions', patterns: [/\b(purchase|order|payment|billing|subscription|transaction|receipt|product)\b/i] },
  { category: 'Advertising & interests', patterns: [/\b(advert|campaign|interest|audience|inferred|marketing|promotion|conversion|attribution)\b/i] },
  { category: 'Contacts & social', patterns: [/\b(contact|friend|follower|following|connection|group|social|relationship)\b/i] },
  { category: 'Photos & media', patterns: [/\b(photo|image|video|media|album|audio|recording|playlist)\b/i] },
  { category: 'Devices & network', patterns: [/\b(device|ip|network|wifi|wi-fi|carrier|browser|operating.?system|user.?agent|identifier|cookie|token)\b/i] },
  { category: 'Security & login', patterns: [/\b(login|signin|sign-in|security|password|authentication|authorized|access.?log|recovery)\b/i] },
  { category: 'Communications', patterns: [/\b(message|chat|email|call|conversation|comment|notification|sms)\b/i] },
  { category: 'Health & fitness', patterns: [/\b(health|fitness|workout|steps|heart|medical|sleep|exercise)\b/i] },
];

function classifyPath(path: string): FootprintCategory {
  return categoryPatterns.find(entry => entry.patterns.some(pattern => pattern.test(path)))?.category ?? 'Other';
}

function detectFormat(text: string): DataFootprintImport['format'] {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  const firstLines = trimmed.split(/\r?\n/).slice(0, 3);
  if (firstLines.length > 1 && firstLines.every(line => line.trim().startsWith('{'))) return 'ndjson';
  return 'csv';
}

function inferProvider(fileName: string, paths: readonly string[]): string {
  const source = `${fileName} ${paths.slice(0, 100).join(' ')}`.toLowerCase();
  if (/google|youtube|takeout/.test(source)) return 'Google';
  if (/facebook|instagram|meta/.test(source)) return 'Meta';
  if (/tiktok/.test(source)) return 'TikTok';
  if (/twitter|tweet|^x[-_. ]/.test(source)) return 'X / Twitter';
  if (/microsoft|outlook|xbox|onedrive/.test(source)) return 'Microsoft';
  if (/apple|icloud/.test(source)) return 'Apple';
  return 'Imported account data';
}

function summarizePaths(paths: string[]): DataFootprintCategorySummary[] {
  const summaries = new Map<FootprintCategory, { fields: number; examples: string[] }>();
  for (const path of paths) {
    const category = classifyPath(path);
    const current = summaries.get(category) ?? { fields: 0, examples: [] };
    current.fields += 1;
    if (current.examples.length < 5 && !current.examples.includes(path)) current.examples.push(path.slice(0, 180));
    summaries.set(category, current);
  }
  return [...summaries].map(([category, summary]) => ({ category, fields: summary.fields, examplePaths: summary.examples })).sort((a, b) => b.fields - a.fields || a.category.localeCompare(b.category));
}

function pathsFromJson(value: unknown): string[] {
  const paths: string[] = [];
  const visit = (current: unknown, path: string, depth: number) => {
    if (paths.length >= MAX_FIELDS || depth > MAX_DEPTH || current === null) return;
    if (Array.isArray(current)) {
      for (const item of current.slice(0, 5000)) visit(item, path ? `${path}[]` : 'items[]', depth + 1);
      return;
    }
    if (typeof current === 'object') {
      for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
        const next = path ? `${path}.${key}` : key;
        if (child === null || typeof child !== 'object') paths.push(next);
        else visit(child, next, depth + 1);
        if (paths.length >= MAX_FIELDS) break;
      }
    }
  };
  visit(value, '', 0);
  return paths;
}

function csvHeaders(line: string): string[] {
  const headers: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index <= line.length; index++) {
    const character = line[index] ?? ',';
    if (character === '"' && line[index + 1] === '"' && quoted) { value += '"'; index++; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === ',' && !quoted) { if (value.trim()) headers.push(value.trim()); value = ''; continue; }
    value += character;
  }
  return headers;
}

export function parseDataFootprintExport(text: string, fileName: string, now = Date.now()): DataFootprintImport {
  if (typeof text !== 'string' || !text.trim()) throw new Error('This export file is empty.');
  let byteLength = 0;
  for (const character of text) { const code = character.codePointAt(0) ?? 0; byteLength += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4; if (byteLength > MAX_FOOTPRINT_EXPORT_BYTES) break; }
  if (byteLength > MAX_FOOTPRINT_EXPORT_BYTES) throw new Error('This export exceeds the 12 MB import limit.');
  const safeName = fileName.trim().slice(0, 200) || 'account-export';
  const format = detectFormat(text);
  let paths: string[] = [];
  try {
    if (format === 'json') paths = pathsFromJson(JSON.parse(text));
    else if (format === 'ndjson') {
      for (const line of text.split(/\r?\n/).filter(Boolean).slice(0, 10_000)) paths.push(...pathsFromJson(JSON.parse(line)));
    } else {
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2 || !lines[0]?.includes(',')) throw new Error('Invalid CSV');
      const headers = csvHeaders(lines[0] ?? '');
      const records = Math.max(1, Math.min(lines.length - 1, 50_000));
      paths = Array.from({ length: records }, () => headers).flat().slice(0, MAX_FIELDS);
    }
  } catch {
    throw new Error('Choose a valid JSON, NDJSON, or CSV file from an account data export.');
  }
  paths = paths.filter(Boolean).slice(0, MAX_FIELDS);
  if (!paths.length) throw new Error('No data fields were found in this export file.');
  return {
    id: `footprint-${now}-${Math.random().toString(36).slice(2, 8)}`,
    provider: inferProvider(safeName, paths),
    fileName: safeName,
    importedAt: now,
    format,
    totalFields: paths.length,
    categories: summarizePaths(paths),
    source: 'user-export',
  };
}

export function isStoredDataFootprint(value: unknown): value is DataFootprintImport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<DataFootprintImport>;
  return typeof item.id === 'string' && item.id.length <= 120
    && typeof item.provider === 'string' && item.provider.length > 0 && item.provider.length <= 120
    && typeof item.fileName === 'string' && item.fileName.length > 0 && item.fileName.length <= 200
    && typeof item.importedAt === 'number' && Number.isFinite(item.importedAt) && item.importedAt >= 0
    && ['json', 'ndjson', 'csv'].includes(String(item.format))
    && typeof item.totalFields === 'number' && Number.isInteger(item.totalFields) && item.totalFields > 0 && item.totalFields <= MAX_FIELDS
    && item.source === 'user-export'
    && Array.isArray(item.categories) && item.categories.every(summary => summary && typeof summary === 'object'
      && typeof summary.category === 'string' && typeof summary.fields === 'number' && Number.isInteger(summary.fields) && summary.fields > 0
      && Array.isArray(summary.examplePaths) && summary.examplePaths.length <= 5 && summary.examplePaths.every(path => typeof path === 'string' && path.length <= 180));
}
