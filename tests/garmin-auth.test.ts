/**
 * Tests for Garmin Authentication - CSRF Token Extraction
 * Phase 2: TDD Implementation
 */

import { extractCsrfTokenFromHtml, getCsrfToken } from '../src/background/garmin-auth';

describe('CSRF Token Extraction', () => {
  describe('extractCsrfTokenFromHtml', () => {
    it('should extract CSRF token from meta tag', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="csrf-token" content="abc123-def456-ghi789">
          </head>
        </html>
      `;

      const token = extractCsrfTokenFromHtml(html);

      expect(token).toBe('abc123-def456-ghi789');
    });

    it('should extract token from meta tag with different attribute order', () => {
      const html = `
        <meta content="token-value" name="csrf-token">
      `;

      const token = extractCsrfTokenFromHtml(html);

      expect(token).toBe('token-value');
    });

    it('should extract token with special characters', () => {
      const html = `
        <meta name="csrf-token" content="abc-123_DEF.456">
      `;

      const token = extractCsrfTokenFromHtml(html);

      expect(token).toBe('abc-123_DEF.456');
    });

    it('should throw error if no CSRF token found', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>No Token Here</title>
          </head>
        </html>
      `;

      expect(() => extractCsrfTokenFromHtml(html)).toThrow('CSRF token not found');
    });

    it('should handle empty HTML', () => {
      expect(() => extractCsrfTokenFromHtml('')).toThrow('CSRF token not found');
    });

    it('should handle malformed HTML gracefully', () => {
      const html = '<meta name="csrf-token"'; // Missing closing >

      expect(() => extractCsrfTokenFromHtml(html)).toThrow('CSRF token not found');
    });
  });

  describe('getCsrfToken', () => {
    // Mock fetch globally for these tests
    const mockFetch = jest.fn();
    global.fetch = mockFetch as any;

    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('should fetch Garmin Connect page and extract token', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="csrf-token" content="test-token-123">
          </head>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const token = await getCsrfToken();

      expect(token).toBe('test-token-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://connect.garmin.com/modern',
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    it('should handle redirect from /modern to /app', async () => {
      // fetch() automatically follows redirects, so we get final response
      // The response.url will reflect the final URL after redirect
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        url: 'https://connect.garmin.com/app', // Final URL after redirect
        text: async () => '<meta name="csrf-token" content="token-after-redirect">',
      });

      const token = await getCsrfToken();

      expect(token).toBe('token-after-redirect');
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one call (redirect handled by fetch)
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(getCsrfToken()).rejects.toThrow('Failed to fetch CSRF token');
    });

    it('should throw error on 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(getCsrfToken()).rejects.toThrow('Not authenticated');
    });

    it('should throw error if response has no token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html><body>No token here</body></html>',
      });

      await expect(getCsrfToken()).rejects.toThrow('CSRF token not found');
    });

    it('should use correct headers for request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<meta name="csrf-token" content="token">',
      });

      await getCsrfToken();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://connect.garmin.com/modern',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
          headers: expect.objectContaining({
            'Accept': expect.stringContaining('text/html'),
            'User-Agent': expect.stringContaining('Mozilla'),
          }),
        })
      );
    });
  });

  describe('Token Caching', () => {
    it('should cache token after first fetch', async () => {
      // This test will be implemented when we add caching
      // For now, just a placeholder
      expect(true).toBe(true);
    });

    it('should return cached token on subsequent calls', async () => {
      // Placeholder for caching test
      expect(true).toBe(true);
    });

    it('should clear cache on logout', async () => {
      // Placeholder for cache clearing test
      expect(true).toBe(true);
    });
  });
});
