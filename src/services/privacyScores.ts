import { ConnectionEvent, PrivacyDataset } from '../types';

export interface PrivacyScoreValue { score: number | null; label: string; detail: string }
export interface PrivacyScores {
  overall: PrivacyScoreValue;
  networkPrivacy: PrivacyScoreValue;
  trackingExposure: PrivacyScoreValue;
  permissionExposure: PrivacyScoreValue;
  evidenceCoverage: PrivacyScoreValue;
}

const bounded = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const scoreLabel = (score: number | null) => score === null ? 'Needs evidence' : score >= 85 ? 'Low exposure' : score >= 70 ? 'Moderate exposure' : score >= 50 ? 'Elevated exposure' : 'High exposure';
const marketing = new Set(['Advertising', 'Analytics', 'Attribution', 'Marketing']);

function contacts(event: ConnectionEvent): number { return Math.max(1, event.reportHits ?? 1); }

export function getPrivacyScores(dataset: PrivacyDataset): PrivacyScores {
  const events = dataset.connections;
  const totalContacts = events.reduce((sum, event) => sum + contacts(event), 0);
  const uniqueDomains = new Set(events.map(event => event.domain.toLowerCase())).size;
  const unknown = events.filter(event => event.category === 'Unknown' || !event.organizationId).reduce((sum, event) => sum + contacts(event), 0);
  const trackers = events.filter(event => event.potentialTracker || marketing.has(event.category)).reduce((sum, event) => sum + contacts(event), 0);
  const unencrypted = events.filter(event => event.protocol === 'Unknown').reduce((sum, event) => sum + contacts(event), 0);
  const networkScore = events.length ? bounded(100 - unknown / Math.max(1, totalContacts) * 28 - unencrypted / Math.max(1, totalContacts) * 18 - Math.min(22, uniqueDomains / 2)) : null;
  const trackingScore = events.length ? bounded(100 - trackers / Math.max(1, totalContacts) * 72 - Math.min(18, new Set(events.filter(event => event.potentialTracker || marketing.has(event.category)).map(event => event.domain)).size * 2)) : null;

  const permissions = dataset.apps.flatMap(app => app.permissions);
  const permissionWeight = permissions.reduce((sum, permission) => sum + (permission.level === 'Allowed' ? 1 : permission.level === 'While using' ? 0.6 : permission.level === 'Limited' ? 0.3 : 0), 0);
  const sensorApps = new Set(dataset.sensors.map(event => event.appId).filter(Boolean)).size;
  const permissionScore = permissions.length || dataset.sensors.length
    ? bounded(100 - permissionWeight / Math.max(1, permissions.length) * 55 - Math.min(25, sensorApps * 3))
    : null;

  const evidenceKinds = [events.length > 0, dataset.sensors.length > 0, (dataset.appUsage?.length ?? 0) > 0, dataset.apps.length > 0];
  const coverageScore = bounded(evidenceKinds.filter(Boolean).length / evidenceKinds.length * 100);
  const available = [networkScore, trackingScore, permissionScore].filter((score): score is number => score !== null);
  const overallScore = available.length ? bounded(available.reduce((sum, score) => sum + score, 0) / available.length) : null;
  const value = (score: number | null, detail: string): PrivacyScoreValue => ({ score, label: scoreLabel(score), detail });
  return {
    overall: value(overallScore, 'A summary of exposure visible in this workspace, not a device safety grade.'),
    networkPrivacy: value(networkScore, events.length ? `${uniqueDomains} unique destinations; unknown ownership and protocol gaps lower this score.` : 'Load network evidence to calculate this score.'),
    trackingExposure: value(trackingScore, events.length ? `${trackers.toLocaleString()} contacts are flagged or classified as marketing-related.` : 'Load domain evidence to calculate this score.'),
    permissionExposure: value(permissionScore, permissions.length || dataset.sensors.length ? `${permissions.length} permission labels and ${dataset.sensors.length} access intervals are in scope.` : 'Load permission or resource-access evidence to calculate this score.'),
    evidenceCoverage: value(coverageScore, `${evidenceKinds.filter(Boolean).length} of ${evidenceKinds.length} local evidence areas currently contain data.`),
  };
}

export function getAppPrivacyScore(dataset: PrivacyDataset, appId: string): PrivacyScoreValue {
  const app = dataset.apps.find(item => item.id === appId);
  if (!app) return { score: null, label: 'Needs evidence', detail: 'App not found.' };
  const events = dataset.connections.filter(event => event.appId === appId);
  const sensors = dataset.sensors.filter(event => event.appId === appId);
  const trackerDomains = new Set(events.filter(event => event.potentialTracker || marketing.has(event.category)).map(event => event.domain)).size;
  const thirdParties = new Set(events.map(event => event.organizationId).filter(Boolean)).size;
  if (!events.length && !sensors.length && !app.permissions.length) return { score: null, label: 'Needs evidence', detail: 'No network, access, or permission evidence is loaded for this app.' };
  const allowed = app.permissions.filter(permission => permission.level === 'Allowed').length;
  const score = bounded(100 - trackerDomains * 7 - thirdParties * 3 - new Set(sensors.map(event => event.sensor)).size * 4 - allowed * 4);
  return { score, label: scoreLabel(score), detail: `${thirdParties} recipients · ${trackerDomains} tracker-related domains · ${new Set(sensors.map(event => event.sensor)).size} accessed resource types` };
}
