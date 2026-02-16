/**
 * Security utilities for URL validation and sanitization
 * Prevents XSS attacks via javascript:, data:, and other unsafe URL schemes
 */

import { MapyGarminError, ErrorCode } from './errors';

const SAFE_URL_SCHEMES = ['https:', 'http:'];
const UNSAFE_URL_SCHEMES = ['javascript:', 'data:', 'file:', 'vbscript:', 'about:', 'blob:'];

/**
 * Checks if URL has a safe scheme (https or http)
 * @param url URL to validate
 * @returns true if URL scheme is safe
 */
function isSafeUrlScheme(url: string): boolean {
  try {
    // Normalize and decode URL to prevent bypass attempts
    const normalized = decodeURIComponent(url).trim().toLowerCase();

    // Check for unsafe schemes
    for (const unsafeScheme of UNSAFE_URL_SCHEMES) {
      if (normalized.startsWith(unsafeScheme)) {
        return false;
      }
    }

    // Parse URL to validate scheme
    const urlObj = new URL(url);
    const scheme = urlObj.protocol.toLowerCase();

    return SAFE_URL_SCHEMES.includes(scheme);
  } catch {
    return false;
  }
}

/**
 * Extracts domain from URL (including subdomains)
 * @param url URL to extract domain from
 * @returns Domain string or null if invalid
 */
function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Checks if domain matches or is subdomain of allowed domain
 * @param domain Domain to check
 * @param allowedDomain Allowed domain (e.g., "garmin.com")
 * @returns true if domain matches or is subdomain of allowed domain
 */
function isDomainAllowed(domain: string, allowedDomain: string): boolean {
  const normalizedDomain = domain.toLowerCase();
  const normalizedAllowed = allowedDomain.toLowerCase();

  // Exact match
  if (normalizedDomain === normalizedAllowed) {
    return true;
  }

  // Subdomain match (e.g., "connect.garmin.com" matches "garmin.com")
  if (normalizedDomain.endsWith('.' + normalizedAllowed)) {
    return true;
  }

  return false;
}

/**
 * Validates URL has safe scheme (https/http) and optional domain whitelist
 *
 * Security considerations:
 * - Rejects javascript:, data:, file:, vbscript:, about:, blob: schemes
 * - Prevents XSS attacks via URL injection
 * - Validates domain against whitelist if provided
 * - Rejects URLs with embedded credentials
 * - Rejects malformed URLs and URLs with whitespace
 *
 * @param url URL to validate
 * @param allowedDomains Optional array of allowed domains (e.g., ["garmin.com", "amazonaws.com"])
 * @returns Validated URL string
 * @throws MapyGarminError if URL is invalid or uses unsafe scheme
 */
export function validateUrl(url: string, allowedDomains?: string[]): string {
  // Reject empty or whitespace-only URLs
  if (!url || url.trim() !== url || url.trim().length === 0) {
    throw new MapyGarminError(
      'Invalid URL: empty or contains whitespace',
      ErrorCode.URL_VALIDATION
    );
  }

  // Check for whitespace anywhere in URL
  if (/\s/.test(url)) {
    throw new MapyGarminError(
      'Invalid URL: contains whitespace',
      ErrorCode.URL_VALIDATION
    );
  }

  // Validate URL scheme
  if (!isSafeUrlScheme(url)) {
    throw new MapyGarminError(
      'Invalid URL: unsafe URL scheme (only https:// and http:// are allowed)',
      ErrorCode.URL_VALIDATION
    );
  }

  // Parse URL for additional validation
  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch (error) {
    throw new MapyGarminError(
      `Invalid URL: malformed URL (${error instanceof Error ? error.message : 'unknown error'})`,
      ErrorCode.URL_VALIDATION
    );
  }

  // Reject URLs with embedded credentials
  if (urlObj.username || urlObj.password) {
    throw new MapyGarminError(
      'Invalid URL: embedded credentials are not allowed',
      ErrorCode.URL_VALIDATION
    );
  }

  // Validate domain if whitelist provided
  if (allowedDomains && allowedDomains.length > 0) {
    const domain = extractDomain(url);
    if (!domain) {
      throw new MapyGarminError(
        'Invalid URL: could not extract domain',
        ErrorCode.URL_VALIDATION
      );
    }

    const isAllowed = allowedDomains.some(allowedDomain =>
      isDomainAllowed(domain, allowedDomain)
    );

    if (!isAllowed) {
      throw new MapyGarminError(
        `Invalid URL: domain "${domain}" is not in allowed domains [${allowedDomains.join(', ')}]`,
        ErrorCode.URL_VALIDATION
      );
    }
  }

  return url;
}

/**
 * Validates image URL for img.src assignment (stricter than general URLs)
 *
 * Image URLs have additional restrictions:
 * - Rejects data: URLs (can contain XSS payloads despite being commonly used for images)
 * - Rejects blob: URLs (can be used for XSS)
 * - Requires https:// or http:// schemes only
 *
 * @param url Image URL to validate
 * @param allowedDomains Optional array of allowed domains
 * @returns Validated image URL string
 * @throws MapyGarminError if URL is invalid or unsafe for image context
 */
export function validateImageUrl(url: string, allowedDomains?: string[]): string {
  // Use general URL validation (covers scheme, domain, credentials, etc.)
  return validateUrl(url, allowedDomains);
}
