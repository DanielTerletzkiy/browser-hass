import { Connection } from './types.ts';

export function GetStatusColor(status: Connection['status']) {
  switch (status) {
    case 'authenticated':
      return '#43a047';
    case 'connecting':
    case 'connected':
      return '#fb8c00';
    case 'error':
    case 'disconnected':
      return '#e53935';
    default:
      return '#9e9e9e';
  }
}

/**
 * Turn whatever the user typed (`homeassistant.local:8123`, `https://ha.example/`,
 * `wss://ha.example/api/websocket`, ...) into the base URL of the frontend.
 * Returns null when it can't be parsed.
 */
export function NormalizeUrl(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!/^[a-z]+:\/\//i.test(value)) value = `http://${value}`;
  try {
    const url = new URL(value);
    if (url.protocol === 'ws:') url.protocol = 'http:';
    else if (url.protocol === 'wss:') url.protocol = 'https:';
    else if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const path = url.pathname
      .replace(/\/api\/websocket\/?$/, '')
      .replace(/\/+$/, '');
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}

export function WebsocketUrl(baseUrl: string) {
  return baseUrl.replace(/^http/, 'ws') + '/api/websocket';
}

/** Same rules as Home Assistant's `slugify` for the characters we can get here */
function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Stable id of this browser profile. Versions <= 0.1.x had the user type it in
 * as "Device ID", keep that one so existing Home Assistant entries still match.
 */
export async function GetDeviceId(): Promise<string> {
  const { deviceId, options } = (await chrome.storage.local.get([
    'deviceId',
    'options',
  ])) as { deviceId?: string; options?: { deviceId?: string } };
  if (deviceId) return deviceId;

  const legacy = options?.deviceId ? slugify(String(options.deviceId)) : '';
  const id = legacy || crypto.randomUUID().replace(/-/g, '');
  await chrome.storage.local.set({ deviceId: id });
  return id;
}

/** Suggested name for the discovered device, e.g. "Firefox on Linux" */
export function DefaultBrowserName() {
  const ua = navigator.userAgent;
  const brands: { brand: string }[] =
    (navigator as any).userAgentData?.brands ?? [];
  const brand = (name: string) => brands.some((b) => b.brand.includes(name));

  let browser = 'Browser';
  if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (brand('Brave')) browser = 'Brave';
  else if (/Edg\//.test(ua) || brand('Edge')) browser = 'Edge';
  else if (/OPR\//.test(ua) || brand('Opera')) browser = 'Opera';
  else if (/Vivaldi\//.test(ua)) browser = 'Vivaldi';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';

  let os = '';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  return os ? `${browser} on ${os}` : browser;
}
