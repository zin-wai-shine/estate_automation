/**
 * Centralized API configuration for BoltHavenProperties.
 * Ensures that API and media requests stay on the same HTTPS origin when accessed
 * through app.bolthavenproperty.com, preventing mixed-content errors.
 */

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const { hostname, port } = window.location;
    // When running standalone on Vite dev server (port 5174) without reverse proxy:
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '5174') {
      return 'http://localhost:8085';
    }
    // When accessed through Nginx reverse proxy or app.bolthavenproperty.com:
    return '';
  }
  return '';
}

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return `${base}${cleanPath}`;
}

export function resolveMediaUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return `${base}${cleanPath}`;
}
