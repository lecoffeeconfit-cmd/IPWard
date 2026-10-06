import { ConnectionCategory, ConnectionEvent, EvidenceState } from '../types';

interface ServiceMeaning { role: string; purpose: string; facility: string }

const meanings: Record<ConnectionCategory, ServiceMeaning> = {
  'App service': { role: 'App service endpoint', purpose: 'Support an app feature or API request', facility: 'Likely a service endpoint; its physical facility is unknown.' },
  CDN: { role: 'Content delivery edge', purpose: 'Serve or cache content closer to users', facility: 'Could be an edge cache or shared delivery server.' },
  Authentication: { role: 'Sign-in service', purpose: 'Check a login, token, or session', facility: 'Likely a service endpoint; its physical facility is unknown.' },
  Cloud: { role: 'Hosted cloud service', purpose: 'Run backend requests, storage, or sync', facility: 'Could be hosted infrastructure; the exact data center is unknown.' },
  Analytics: { role: 'Measurement service', purpose: 'Measure app or site usage', facility: 'Likely a processing endpoint; its physical facility is unknown.' },
  Advertising: { role: 'Advertising service', purpose: 'Deliver or measure ads', facility: 'Likely a processing endpoint; its physical facility is unknown.' },
  Attribution: { role: 'Attribution service', purpose: 'Measure installs or campaign results', facility: 'Likely a processing endpoint; its physical facility is unknown.' },
  Marketing: { role: 'Engagement service', purpose: 'Support marketing or engagement tools', facility: 'Likely a processing endpoint; its physical facility is unknown.' },
  Telemetry: { role: 'Diagnostics service', purpose: 'Collect operational or performance signals', facility: 'Likely a processing endpoint; its physical facility is unknown.' },
  'Crash reporting': { role: 'Error reporting service', purpose: 'Receive crash or error reports', facility: 'Likely a processing endpoint; its physical facility is unknown.' },
  Communication: { role: 'Communication service', purpose: 'Support messaging or calls', facility: 'Likely a service endpoint; its physical facility is unknown.' },
  Unknown: { role: 'Role unknown', purpose: 'Purpose unavailable', facility: 'No reliable facility type can be inferred.' },
};

export interface DestinationInsight {
  location: string;
  locationState: EvidenceState;
  locationExplanation: string;
  role: string;
  purpose: string;
  roleState: EvidenceState;
  facility: string;
  regionReason: string;
}

/** Interprets only fields already present in the record; never geolocates a domain or IP. */
export function getDestinationInsight(event: ConnectionEvent): DestinationInsight {
  const hasLocation = !!event.countryCode && !!event.country && event.country !== 'Unavailable';
  const hasCategoryHint = event.classification.source !== 'unknown'
    && event.classification.categories.some(category => category !== 'Unknown');
  const category = hasCategoryHint
    ? event.classification.categories.find(item => item !== 'Unknown') ?? 'Unknown'
    : 'Unknown';
  const meaning = meanings[category];
  const sample = event.source === 'demo';
  return {
    location: hasLocation ? [event.region, event.country].filter(Boolean).join(', ') : 'Location unavailable',
    locationState: hasLocation ? 'Estimated' : 'Unavailable',
    locationExplanation: hasLocation
      ? sample ? 'Fictional sample endpoint region. No device traffic was located.' : 'Estimated endpoint region from this record; it does not show where data was stored or processed later.'
      : event.source === 'user-import' ? 'Apple’s report supplies a domain, but no IP address or endpoint location.' : 'This record has no endpoint region. A domain name alone cannot locate its server.',
    role: meaning.role,
    purpose: meaning.purpose,
    roleState: hasCategoryHint ? 'Estimated' : 'Unavailable',
    facility: meaning.facility,
    regionReason: hasLocation
      ? 'Routing, available capacity, or a nearby edge server could explain this region. This record cannot identify which reason applies.'
      : 'No region is available to explain for this contact.',
  };
}
