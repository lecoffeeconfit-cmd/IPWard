import { ConnectionCategory, EndpointClassification } from '../types';

interface EndpointRule { suffix: string; organizationId: string; categories: ConnectionCategory[] }
// Illustrative endpoint rules for the fixture; never an authoritative tracker database.
const RULES: EndpointRule[] = [
  { suffix: 'graph.instagram.com', organizationId: 'meta', categories: ['App service'] },
  { suffix: 'cdninstagram.com', organizationId: 'meta', categories: ['CDN'] },
  { suffix: 'whatsapp.net', organizationId: 'meta', categories: ['Communication'] },
  { suffix: 'google-analytics.com', organizationId: 'google', categories: ['Analytics'] },
  { suffix: 'app-measurement.com', organizationId: 'google', categories: ['Analytics'] },
  { suffix: 'doubleclick.net', organizationId: 'google', categories: ['Advertising'] },
  { suffix: 'accounts.google.com', organizationId: 'google', categories: ['Authentication'] },
  { suffix: 'appsflyer.com', organizationId: 'appsflyer', categories: ['Attribution', 'Marketing'] },
  { suffix: 'adjust.com', organizationId: 'adjust', categories: ['Attribution'] },
  { suffix: 'api.spotify.com', organizationId: 'spotify', categories: ['App service'] },
  { suffix: 'scdn.co', organizationId: 'spotify', categories: ['CDN'] },
  { suffix: 'icloud.com', organizationId: 'apple', categories: ['Cloud'] },
  { suffix: 'apple-mapkit.com', organizationId: 'apple', categories: ['App service'] },
  { suffix: 'outlook.office365.com', organizationId: 'microsoft', categories: ['Communication'] },
  { suffix: 'api.notion.com', organizationId: 'notion', categories: ['App service'] },
  { suffix: 'cloudflare.com', organizationId: 'cloudflare', categories: ['CDN'] },
];

/** Suffix matching is boundary-aware: evilgoogle-analytics.com never matches. */
export function classifyDomain(rawDomain: string): EndpointClassification {
  const domain = rawDomain.trim().toLowerCase().replace(/\.$/, '');
  const valid = domain.length <= 253 && domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
  const rule = valid ? RULES.filter(candidate => domain === candidate.suffix || domain.endsWith(`.${candidate.suffix}`)).sort((a, b) => b.suffix.length - a.suffix.length)[0] : undefined;
  return { domain, organizationId: rule?.organizationId ?? null, categories: rule?.categories ?? ['Unknown'], confidence: rule ? 'medium' : 'low', source: rule ? 'bundled-demo-rules' : 'unknown', lastUpdated: '2026-09-30', explanation: rule ? 'Illustrative endpoint category. A connection does not establish the contents or purpose of a specific transfer.' : 'No matching endpoint rule. Unknown does not mean unsafe.' };
}

export function isMarketingCategory(category: ConnectionCategory): boolean {
  return ['Advertising', 'Analytics', 'Attribution', 'Marketing'].includes(category);
}
