import { LocalReputationList } from '../types';
import { classifyDomain } from './classifier';

export type WebFindingSeverity = 'information' | 'review' | 'important';
export interface WebPrivacyFinding { id: string; title: string; detail: string; severity: WebFindingSeverity }
export interface WebPrivacyReview {
  input: string;
  normalizedUrl: string;
  sanitizedUrl: string;
  domain: string;
  reviewPriority: number;
  findings: WebPrivacyFinding[];
  categories: string[];
  localListMatch: boolean;
}

const trackingParameters = new Set(['fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid', 'igshid', 'ref', 'referrer', 'campaign']);
const redirectParameters = new Set(['url', 'target', 'redirect', 'redirect_url', 'redirect_uri', 'next', 'continue', 'destination']);
const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function analyzeWebAddress(raw: string, localList: LocalReputationList | null = null): WebPrivacyReview {
  const input = raw.trim();
  if (!input || input.length > 2048) throw new Error('Enter a website address up to 2,048 characters.');
  let url: URL;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`); }
  catch { throw new Error('Enter a complete website address, such as https://example.com.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS website addresses can be reviewed.');
  const domain = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!domain || (!domain.includes('.') && domain !== 'localhost')) throw new Error('Enter a complete website domain.');
  const findings: WebPrivacyFinding[] = [];
  let priority = 0;
  const add = (id: string, title: string, detail: string, severity: WebFindingSeverity, weight: number) => { findings.push({ id, title, detail, severity }); priority += weight; };
  if (url.protocol === 'http:') add('http', 'Connection is not HTTPS', 'Information sent over plain HTTP may be exposed on the network.', 'important', 35);
  if (url.username || url.password) add('credentials', 'Credentials are embedded in the address', 'Avoid sharing or opening URLs that contain a username or password.', 'important', 30);
  if (domain.startsWith('xn--') || domain.includes('.xn--')) add('punycode', 'Internationalized domain needs review', 'Punycode can be legitimate, but it is also used in lookalike domains.', 'review', 18);
  if (ipv4.test(domain)) add('ip-host', 'Address uses a raw IP', 'Legitimate services can use IP addresses, but there is no domain name to inspect.', 'review', 12);
  if (url.port && !['80', '443'].includes(url.port)) add('port', 'Non-standard web port', `This address uses port ${url.port}.`, 'review', 8);
  const trackingKeys = [...url.searchParams.keys()].filter(key => key.toLowerCase().startsWith('utm_') || trackingParameters.has(key.toLowerCase()));
  if (trackingKeys.length) add('tracking-params', 'Tracking parameters found', `${trackingKeys.length} campaign or referral parameters can be removed without changing the destination in many cases.`, 'review', Math.min(22, 5 + trackingKeys.length * 3));
  const redirects = [...url.searchParams.keys()].filter(key => redirectParameters.has(key.toLowerCase()));
  if (redirects.length) add('redirect', 'Redirect destination parameter found', 'Check the nested destination before opening the link.', 'review', 12);
  const longLabel = domain.split('.').some(label => label.length > 35 || (label.length > 18 && /\d/.test(label) && /[a-z]/i.test(label)));
  if (longLabel) add('unusual-host', 'Unusual hostname shape', 'A long or mixed-character hostname deserves a closer look, but is not proof of harm.', 'review', 8);
  const listMatch = !!localList?.domains.includes(domain);
  if (listMatch) add('local-list', 'Found in your local domain list', `Exact match in ${localList?.name ?? 'your imported list'}. The source and meaning of that list are not verified by IPward.`, 'important', 30);
  const classification = classifyDomain(domain);
  if (classification.categories.some(category => ['Advertising', 'Analytics', 'Attribution', 'Marketing'].includes(category))) add('provider', 'Known marketing-related provider hint', `${classification.categories.join(', ')} based on the bundled offline directory.`, 'information', 8);
  if (!findings.length) findings.push({ id: 'none', title: 'No local heuristic callouts', detail: 'This does not establish that the site is safe. IPward did not query a live reputation service.', severity: 'information' });
  const sanitized = new URL(url.toString());
  for (const key of [...sanitized.searchParams.keys()]) if (key.toLowerCase().startsWith('utm_') || trackingParameters.has(key.toLowerCase())) sanitized.searchParams.delete(key);
  return { input, normalizedUrl: url.toString(), sanitizedUrl: sanitized.toString(), domain, reviewPriority: Math.min(100, priority), findings, categories: classification.categories, localListMatch: listMatch };
}
