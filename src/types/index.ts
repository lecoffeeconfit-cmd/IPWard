/** Every fact carries its provenance. Demo is a source, never a certainty level. */
export type DataMode = 'demo' | 'device';
export type TimeRange = 'Live' | 'Today' | 'Yesterday' | '7 days' | '30 days';
export type EvidenceState = 'Confirmed' | 'Observed' | 'Estimated' | 'Unavailable';
export type Confidence = 'high' | 'medium' | 'low';
export type EventSource = 'demo' | 'network-extension' | 'vpn-service' | 'device-activity' | 'notification-listener' | 'authorized-integration' | 'user-import';
export interface Provenance { state: EvidenceState; source: EventSource; confidence: Confidence; explanation: string }
export type ForegroundState = 'foreground' | 'background' | 'unknown';
export type ConnectionCategory = 'App service' | 'CDN' | 'Authentication' | 'Cloud' | 'Analytics' | 'Advertising' | 'Attribution' | 'Marketing' | 'Telemetry' | 'Crash reporting' | 'Communication' | 'Unknown';
export type RuleAction = 'allow' | 'block' | 'alert' | 'ignore';
export type RuleTarget = 'domain' | 'ip' | 'ip-range' | 'asn' | 'country' | 'organization' | 'category';
/** Local decision rule. Enforcement requires a platform filtering provider. */
export interface NetworkRule { id: string; action: RuleAction; target: RuleTarget; value: string; createdAt: number; expiresAt?: number }
/** Exact-domain list selected by the user. Its source is not independently verified. */
export interface LocalReputationList { name: string; importedAt: number; domains: string[]; source: 'user-import' }
export type SensorType = 'Microphone' | 'Camera' | 'Location' | 'Photos' | 'Contacts' | 'Bluetooth' | 'Calendar';
export interface AppPermission { sensor: SensorType; level: 'Allowed' | 'While using' | 'Limited' | 'Denied' | 'Unknown'; provenance: Provenance }
export interface AppProfile { id: string; identifier: string; name: string; initials: string; color: string; icon: string; category: string; permissions: AppPermission[]; source: EventSource }
export interface Organization { id: string; name: string; initials: string; color: string; description: string }
export interface EndpointClassification { domain: string; organizationId: string | null; categories: ConnectionCategory[]; confidence: Confidence; source: 'bundled-demo-rules' | 'bundled-provider-hints' | 'unknown'; lastUpdated: string; explanation: string }
export interface ConnectionEvent { id: string; timestamp: number; appId: string | null; domain: string; ip: string; port: number; protocol: 'TLS' | 'QUIC' | 'HTTPS' | 'Unknown'; organizationId: string | null; country: string; countryCode: string; region: string; asn: string; bytesUploaded: number; bytesDownloaded: number; /** False when a source reports a domain contact but no transfer totals. */ bytesMeasured?: boolean; /** Aggregated contacts in an imported report, not individual connections. */ reportHits?: number; /** First contact timestamp supplied by Apple, when present. `timestamp` is the latest contact. */ reportFirstAt?: number; potentialTracker?: boolean; foregroundState: ForegroundState; category: ConnectionCategory; classification: EndpointClassification; isNewDestination: boolean; captureSessionId?: string; source: EventSource; provenance: Provenance }
export interface SensorEvent { id: string; timestamp: number; timestampEnd: number; appId: string | null; sensor: SensorType; foregroundState: ForegroundState; source: EventSource; provenance: Provenance }
export interface CommunicationEvent { id: string; timestamp: number; appId: string; type: 'call' | 'email' | 'notification' | 'app-usage'; direction: 'incoming' | 'outgoing' | 'unknown'; durationSeconds: number; count: number; source: EventSource; provenance: Provenance }
export interface AppUsageRecord { id: string; appId: string; dayStart: number; durationSeconds: number; lastTimeUsed: number; source: 'device-activity'; provenance: Provenance }
export interface ActivityAlert { id: string; timestamp: number; appId: string; title: string; description: string; severity: 'Information' | 'Notice' | 'Important'; connectionId: string; source: EventSource }
/** A person's own observation, never an automatically detected ad impression. */
export type RecalledOrigin = 'spoken' | 'browser-typing' | 'other' | 'unsure';
export interface AdSighting { id: string; observedAt: number; appName: string; wording: string; /** Optional user recollection, not detected device activity. */ recalledOrigin?: RecalledOrigin; topics?: string[]; source: 'user-note' }
/** A domain first observed by IPWard during a report import; this is not proof it is new to the app. */
export interface NewDomainNotice { id: string; appId: string | null; appName: string; domain: string; organizationName: string | null; organizationHint: boolean; potentialTracker: boolean; firstSeenAt: number; source: 'user-import' }
export interface PrivacyDataset { mode: DataMode; generatedAt: number; apps: AppProfile[]; organizations: Organization[]; connections: ConnectionEvent[]; sensors: SensorEvent[]; communications: CommunicationEvent[]; appUsage?: AppUsageRecord[]; alerts: ActivityAlert[] }
export interface ConnectionSummary { connections: number; uploaded: number; downloaded: number; measuredTransfers?: number; background: number; organizations: number; apps: number; countries: number; marketing: number; analytics: number; unknown: number; newDestinations: number; domains: number }
export interface CaptureSession { id: string; name: string; mode: DataMode; kind?: 'demo' | 'report-snapshot' | 'live'; startedAt: number; endedAt: number | null; appId: string | null; status: 'recording' | 'saved'; connections: ConnectionEvent[]; sensors: SensorEvent[]; summary: ConnectionSummary; notes: string; schemaVersion: 1 }
export interface CommunicationEstimate { value: number | null; unit: 'activity windows'; state: 'Estimated' | 'Unavailable'; confidence: Confidence; inputSignals: string[]; timestamp: number; algorithmVersion: string; explanation: string; source: EventSource }
export interface DateInterval { start: number; end: number }

export type ProtectionMode = 'Standard' | 'Privacy' | 'Strict Privacy' | 'High-Risk Protection';
export type FootprintCategory = 'Identity & account' | 'Location' | 'Browsing & search' | 'App activity' | 'Purchases & subscriptions' | 'Advertising & interests' | 'Contacts & social' | 'Photos & media' | 'Devices & network' | 'Security & login' | 'Communications' | 'Health & fitness' | 'Other';
export interface DataFootprintCategorySummary { category: FootprintCategory; fields: number; examplePaths: string[] }
/** Metadata inventory derived from a user-selected account export. Raw values are never retained. */
export interface DataFootprintImport {
  id: string;
  provider: string;
  fileName: string;
  importedAt: number;
  format: 'json' | 'ndjson' | 'csv';
  totalFields: number;
  categories: DataFootprintCategorySummary[];
  source: 'user-export';
}
