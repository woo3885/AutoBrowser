export function normalizePublicHttpsUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate || candidate.length > 2048) return null;
  try {
    const url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
        host.endsWith('.internal') || host === '0.0.0.0' || host === '::1' ||
        /^127\./u.test(host) || /^10\./u.test(host) || /^192\.168\./u.test(host) ||
        /^169\.254\./u.test(host) || /^172\.(1[6-9]|2\d|3[01])\./u.test(host)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}
