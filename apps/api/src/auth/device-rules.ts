import { createHash } from 'node:crypto';

// A staff account may be used from two devices. The third device locks the account until an administrator reactivates it.
export const MAX_STAFF_DEVICES = 2;
export const DEVICE_COOKIE = 'bt_device';
export const DEVICE_COOKIE_MAX_AGE_MS = 5 * 365 * 86_400_000;

// The browser keeps the secret; only a hash of it is stored.
export const hashDeviceToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const isDeviceToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value);

// "Chrome on Android": enough for an administrator to recognise which phone or computer it was.
export function describeDevice(userAgent?: string | null) {
  const ua = userAgent ?? '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\/|CriOS\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null;
  const system = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : null;
  if (!browser && !system) return 'Unknown device';
  return [browser ?? 'Browser', system].filter(Boolean).join(' on ');
}
