import type { IconName } from '../components/ui';
import type { Route } from '../state/AppContext';

export type PrimaryRoute = 'Overview' | 'Network' | 'Data' | 'Device' | 'Protect' | 'Settings';
export type SectionLink = { route: Route; title: string; detail: string; icon: IconName };

export const primaryDestinations: { route: PrimaryRoute; label: string; icon: IconName }[] = [
  { route: 'Overview', label: 'Home', icon: 'home' },
  { route: 'Network', label: 'Network', icon: 'git-branch' },
  { route: 'Data', label: 'Data', icon: 'grid' },
  { route: 'Device', label: 'Device', icon: 'smartphone' },
  { route: 'Protect', label: 'Protect', icon: 'shield' },
  { route: 'Settings', label: 'Settings', icon: 'settings' },
];

export const sectionForRoute: Record<Route, PrimaryRoute> = {
  Overview: 'Overview', Network: 'Network', Data: 'Data', Device: 'Device', Protect: 'Protect', Settings: 'Settings',
  Activity: 'Overview', Alerts: 'Overview', Captures: 'Overview',
  Connections: 'Network', 'Live Monitor': 'Network', Destinations: 'Network', 'Web Privacy': 'Network',
  Apps: 'Data', Marketing: 'Data', 'Privacy Map': 'Data', Communication: 'Data',
  Sensors: 'Device', 'Device Checks': 'Device', Security: 'Protect', Trust: 'Settings',
};

export const sectionLinks: Record<PrimaryRoute, readonly SectionLink[]> = {
  Overview: [
    { route: 'Alerts', title: 'Alerts', detail: 'Review noteworthy changes and first-seen report notices.', icon: 'bell' },
    { route: 'Activity', title: 'Activity', detail: 'Follow the timeline of available events.', icon: 'activity' },
    { route: 'Captures', title: 'Captures', detail: 'Compare a focused moment with prior records.', icon: 'aperture' },
  ],
  Network: [
    { route: 'Live Monitor', title: 'Live', detail: 'Inspect the feed and its source limitations.', icon: 'radio' },
    { route: 'Connections', title: 'Domains', detail: 'Review domain contacts and connection records.', icon: 'git-branch' },
    { route: 'Destinations', title: 'Companies', detail: 'Explore organizations and known endpoints.', icon: 'globe' },
    { route: 'Web Privacy', title: 'Web privacy', detail: 'Inspect a link locally and review browser controls.', icon: 'compass' },
  ],
  Data: [
    { route: 'Apps', title: 'Apps', detail: 'Compare app-level activity and access.', icon: 'grid' },
    { route: 'Privacy Map', title: 'Data types & recipients', detail: 'Follow data categories, exports and possible recipients.', icon: 'share-2' },
    { route: 'Marketing', title: 'Trackers & ads', detail: 'Inspect possible ad signals and your own notes.', icon: 'target' },
    { route: 'Communication', title: 'Communication', detail: 'Review available communication signals and their limits.', icon: 'message-circle' },
  ],
  Device: [
    { route: 'Sensors', title: 'Permissions & sensors', detail: 'Review access intervals by resource and app.', icon: 'eye' },
    { route: 'Device Checks', title: 'System & Wi-Fi', detail: 'Open device checks and connectivity diagnostics.', icon: 'wifi' },
  ],
  Protect: [
    { route: 'Security', title: 'Threats & scan', detail: 'Review indicator comparisons, device checks and diagnostics.', icon: 'shield' },
  ],
  Settings: [
    { route: 'Trust', title: 'Trust & transparency', detail: 'See what IPward can and cannot know.', icon: 'lock' },
  ],
};

export const sectionLabel = (route: PrimaryRoute) => route === 'Overview' ? 'Home' : route;
