export type ConnectionTestSize = 'quick' | 'standard';
export type ConnectionLink = 'WIFI' | 'CELLULAR' | 'BLUETOOTH' | 'VPN' | 'ETHERNET' | 'NONE' | 'OTHER' | 'UNKNOWN';

export interface ConnectionTestResult {
  version: 1;
  id: string;
  recordedAt: number;
  link: ConnectionLink;
  size: ConnectionTestSize;
  provider: 'Cloudflare';
  latencyMs: number;
  variationMs: number;
  downloadMbps: number;
  uploadMbps: number;
  downloadedBytes: number;
  uploadedBytes: number;
}

export const CONNECTION_TEST_SIZES: Record<ConnectionTestSize, { download: number; upload: number }> = {
  quick: { download: 250_000, upload: 100_000 },
  standard: { download: 2_000_000, upload: 1_000_000 },
};

const endpoint = 'https://speed.cloudflare.com';
const round = (value: number) => Math.round(value * 10) / 10;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const mbps = (bytes: number, elapsedMs: number) => round(bytes * 8 / Math.max(elapsedMs, 1) / 1000);

/** A bounded, user-started internet test. Results include HTTP and app overhead. */
export async function runConnectionTest(
  size: ConnectionTestSize,
  link: ConnectionLink,
  signal: AbortSignal,
  onProgress?: (fraction: number) => void,
  request: typeof fetch = fetch,
): Promise<ConnectionTestResult> {
  if (signal.aborted) throw new Error('The connection test was cancelled.');
  const limits = CONNECTION_TEST_SIZES[size];
  const latency: number[] = [];
  for (let index = 0; index < 3; index++) {
    const started = performance.now();
    const response = await request(`${endpoint}/__down?bytes=0`, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error('The test server did not respond. Try again later.');
    await response.arrayBuffer();
    latency.push(performance.now() - started);
    onProgress?.((index + 1) * 0.12);
  }

  const downloadStarted = performance.now();
  const download = await request(`${endpoint}/__down?bytes=${limits.download}`, { signal, cache: 'no-store' });
  if (!download.ok) throw new Error('The download test did not finish. Try again later.');
  const payload = await download.arrayBuffer();
  const downloadTime = performance.now() - downloadStarted;
  if (payload.byteLength !== limits.download) throw new Error('The download was incomplete. No speed result was saved.');
  onProgress?.(0.72);

  const uploadStarted = performance.now();
  const upload = await request(`${endpoint}/__up`, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '0'.repeat(limits.upload), signal,
  });
  if (!upload.ok) throw new Error('The upload test did not finish. Try again later.');
  await upload.arrayBuffer();
  if (signal.aborted) throw new Error('The connection test was cancelled.');
  const uploadTime = performance.now() - uploadStarted;
  onProgress?.(1);

  const recordedAt = Date.now();
  return {
    version: 1,
    id: `${recordedAt}-${Math.random().toString(36).slice(2, 8)}`,
    recordedAt,
    link,
    size,
    provider: 'Cloudflare',
    latencyMs: round(median(latency)),
    variationMs: round(Math.max(...latency) - Math.min(...latency)),
    downloadMbps: mbps(payload.byteLength, downloadTime),
    uploadMbps: mbps(limits.upload, uploadTime),
    downloadedBytes: payload.byteLength,
    uploadedBytes: limits.upload,
  };
}

export function isStoredConnectionTest(value: unknown): value is ConnectionTestResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Partial<ConnectionTestResult>;
  return result.version === 1 && typeof result.id === 'string' && /^[0-9]+-[a-z0-9]{1,12}$/.test(result.id)
    && typeof result.recordedAt === 'number' && Number.isFinite(result.recordedAt) && result.recordedAt > 0 && result.recordedAt <= Date.now() + 86_400_000
    && ['WIFI', 'CELLULAR', 'BLUETOOTH', 'VPN', 'ETHERNET', 'NONE', 'OTHER', 'UNKNOWN'].includes(result.link ?? '')
    && (result.size === 'quick' || result.size === 'standard') && result.provider === 'Cloudflare'
    && (['latencyMs', 'variationMs', 'downloadMbps', 'uploadMbps'] as const).every(key => typeof result[key] === 'number' && Number.isFinite(result[key]) && result[key] >= 0 && result[key] <= 100_000)
    && result.downloadedBytes === CONNECTION_TEST_SIZES[result.size].download
    && result.uploadedBytes === CONNECTION_TEST_SIZES[result.size].upload;
}
