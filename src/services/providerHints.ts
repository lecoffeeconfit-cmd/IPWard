import { ConnectionCategory } from '../types';

interface ProviderHint { suffix: string; company: string; categories: ConnectionCategory[]; note: string }

/** Small offline hints for well-known service domains; this is not a complete or authoritative tracker list. */
const hints: ProviderHint[] = [
  { suffix: 'google-analytics.com', company: 'Google', categories: ['Analytics'], note: 'Analytics service domain' },
  { suffix: 'app-measurement.com', company: 'Google', categories: ['Analytics'], note: 'App measurement service domain' },
  { suffix: 'doubleclick.net', company: 'Google', categories: ['Advertising'], note: 'Advertising service domain' },
  { suffix: 'googleadservices.com', company: 'Google', categories: ['Advertising'], note: 'Advertising service domain' },
  { suffix: 'googlesyndication.com', company: 'Google', categories: ['Advertising'], note: 'Advertising service domain' },
  { suffix: 'graph.instagram.com', company: 'Meta', categories: ['App service'], note: 'Instagram API domain' },
  { suffix: 'graph.facebook.com', company: 'Meta', categories: ['App service'], note: 'Facebook API domain' },
  { suffix: 'connect.facebook.net', company: 'Meta', categories: ['App service'], note: 'Meta SDK domain' },
  { suffix: 'cdninstagram.com', company: 'Meta', categories: ['CDN'], note: 'Instagram content delivery domain' },
  { suffix: 'appsflyer.com', company: 'AppsFlyer', categories: ['Attribution', 'Marketing'], note: 'Mobile attribution service domain' },
  { suffix: 'adjust.com', company: 'Adjust', categories: ['Attribution'], note: 'Mobile attribution service domain' },
  { suffix: 'branch.io', company: 'Branch', categories: ['Attribution'], note: 'Mobile linking and attribution domain' },
  { suffix: 'sentry.io', company: 'Sentry', categories: ['Crash reporting'], note: 'Error monitoring service domain' },
  { suffix: 'crashlytics.com', company: 'Google Firebase', categories: ['Crash reporting'], note: 'Crash reporting service domain' },
  { suffix: 'segment.io', company: 'Twilio Segment', categories: ['Analytics'], note: 'Customer data and analytics service domain' },
  { suffix: 'segment.com', company: 'Twilio Segment', categories: ['Analytics'], note: 'Customer data and analytics service domain' },
  { suffix: 'amplitude.com', company: 'Amplitude', categories: ['Analytics'], note: 'Product analytics service domain' },
  { suffix: 'mixpanel.com', company: 'Mixpanel', categories: ['Analytics'], note: 'Product analytics service domain' },
  { suffix: 'auth0.com', company: 'Auth0', categories: ['Authentication'], note: 'Authentication service domain' },
  { suffix: 'okta.com', company: 'Okta', categories: ['Authentication'], note: 'Identity service domain' },
  { suffix: 'cloudflare.com', company: 'Cloudflare', categories: ['CDN'], note: 'Content delivery and network infrastructure domain' },
  { suffix: 'cloudflare-dns.com', company: 'Cloudflare', categories: ['CDN'], note: 'DNS and network infrastructure domain' },
  { suffix: 'cloudfront.net', company: 'Amazon Web Services', categories: ['CDN'], note: 'Content delivery infrastructure domain' },
  { suffix: 'fastly.net', company: 'Fastly', categories: ['CDN'], note: 'Content delivery infrastructure domain' },
  { suffix: 'akamaiedge.net', company: 'Akamai', categories: ['CDN'], note: 'Content delivery infrastructure domain' },
  { suffix: 'amazonaws.com', company: 'Amazon Web Services', categories: ['Cloud'], note: 'Cloud infrastructure domain' },
  { suffix: 'datadoghq.com', company: 'Datadog', categories: ['Telemetry'], note: 'Monitoring and telemetry service domain' },
];

/** Returns a cautious suffix hint only; Apple owner labels take precedence in imported reports. */
export function inferProviderHint(rawDomain: string): ProviderHint | null {
  const domain = rawDomain.trim().toLowerCase().replace(/\.$/, '');
  return hints.filter(item => domain === item.suffix || domain.endsWith(`.${item.suffix}`)).sort((a, b) => b.suffix.length - a.suffix.length)[0] ?? null;
}
