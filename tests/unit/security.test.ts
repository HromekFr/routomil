import { validateUrl, validateImageUrl } from '../../src/shared/security';
import { MapyGarminError } from '../../src/shared/errors';

describe('validateUrl', () => {
  describe('URL scheme validation', () => {
    it('should accept https:// URLs', () => {
      const url = 'https://connect.garmin.com/modern/course/123';
      expect(validateUrl(url)).toBe(url);
    });

    it('should accept http:// URLs', () => {
      const url = 'http://example.com/path';
      expect(validateUrl(url)).toBe(url);
    });

    it('should reject javascript: URLs', () => {
      expect(() => validateUrl('javascript:alert(1)')).toThrow(MapyGarminError);
      expect(() => validateUrl('javascript:alert(1)')).toThrow('unsafe URL scheme');
    });

    it('should reject data: URLs', () => {
      expect(() => validateUrl('data:text/html,<script>alert(1)</script>')).toThrow(MapyGarminError);
    });

    it('should reject file: URLs', () => {
      expect(() => validateUrl('file:///etc/passwd')).toThrow(MapyGarminError);
    });

    it('should reject vbscript: URLs', () => {
      expect(() => validateUrl('vbscript:msgbox(1)')).toThrow(MapyGarminError);
    });

    it('should reject about: URLs', () => {
      expect(() => validateUrl('about:blank')).toThrow(MapyGarminError);
    });

    it('should reject URLs with encoded javascript scheme', () => {
      expect(() => validateUrl('%6a%61%76%61%73%63%72%69%70%74:alert(1)')).toThrow(MapyGarminError);
    });

    it('should reject URLs with mixed case schemes', () => {
      expect(() => validateUrl('JaVaScRiPt:alert(1)')).toThrow(MapyGarminError);
      expect(() => validateUrl('JAVASCRIPT:alert(1)')).toThrow(MapyGarminError);
    });
  });

  describe('domain whitelist validation', () => {
    it('should accept URL from allowed domain', () => {
      const url = 'https://connect.garmin.com/modern/course/123';
      expect(validateUrl(url, ['garmin.com'])).toBe(url);
    });

    it('should accept URL from subdomain of allowed domain', () => {
      const url = 'https://connect.garmin.com/modern/course/123';
      expect(validateUrl(url, ['garmin.com'])).toBe(url);
    });

    it('should accept URL from multiple allowed domains', () => {
      const url = 'https://s3.amazonaws.com/bucket/image.jpg';
      expect(validateUrl(url, ['garmin.com', 'amazonaws.com'])).toBe(url);
    });

    it('should reject URL from non-allowed domain', () => {
      expect(() => validateUrl('https://evil.com/phishing', ['garmin.com'])).toThrow(MapyGarminError);
      expect(() => validateUrl('https://evil.com/phishing', ['garmin.com'])).toThrow('not in allowed domains');
    });

    it('should reject URL with similar but different domain', () => {
      expect(() => validateUrl('https://garmin.com.evil.com/fake', ['garmin.com'])).toThrow(MapyGarminError);
    });

    it('should handle URLs without domain whitelist', () => {
      const url = 'https://example.com/path';
      expect(validateUrl(url)).toBe(url);
    });
  });

  describe('edge cases', () => {
    it('should reject empty string', () => {
      expect(() => validateUrl('')).toThrow(MapyGarminError);
    });

    it('should reject malformed URLs', () => {
      expect(() => validateUrl('not a url')).toThrow(MapyGarminError);
      expect(() => validateUrl('htp://missing-t.com')).toThrow(MapyGarminError);
    });

    it('should reject URLs with whitespace', () => {
      expect(() => validateUrl(' https://example.com ')).toThrow(MapyGarminError);
      expect(() => validateUrl('https://example.com/path with spaces')).toThrow(MapyGarminError);
    });

    it('should reject URLs with credentials', () => {
      expect(() => validateUrl('https://user:pass@example.com')).toThrow(MapyGarminError);
    });

    it('should handle URLs with query parameters', () => {
      const url = 'https://connect.garmin.com/modern/course/123?param=value';
      expect(validateUrl(url, ['garmin.com'])).toBe(url);
    });

    it('should handle URLs with hash fragments', () => {
      const url = 'https://connect.garmin.com/modern/course/123#section';
      expect(validateUrl(url, ['garmin.com'])).toBe(url);
    });

    it('should handle URLs with ports', () => {
      const url = 'https://example.com:8080/path';
      expect(validateUrl(url)).toBe(url);
    });
  });

  describe('error handling', () => {
    it('should throw MapyGarminError with URL_VALIDATION error code', () => {
      try {
        validateUrl('javascript:alert(1)');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MapyGarminError);
        expect((error as MapyGarminError).code).toBe('URL_VALIDATION');
      }
    });

    it('should include descriptive error message', () => {
      try {
        validateUrl('javascript:alert(1)');
        fail('Expected error to be thrown');
      } catch (error) {
        expect((error as MapyGarminError).message).toContain('unsafe URL scheme');
      }
    });
  });
});

describe('validateImageUrl', () => {
  describe('basic validation', () => {
    it('should accept valid HTTPS image URLs', () => {
      const url = 'https://s3.amazonaws.com/garmin-connect/profile-images/user123.jpg';
      expect(validateImageUrl(url)).toBe(url);
    });

    it('should accept HTTP image URLs', () => {
      const url = 'http://example.com/image.png';
      expect(validateImageUrl(url)).toBe(url);
    });

    it('should reject javascript: URLs', () => {
      expect(() => validateImageUrl('javascript:alert(1)')).toThrow(MapyGarminError);
    });

    it('should reject data: URLs for images', () => {
      // data: URLs are commonly used for images but can contain XSS payloads
      expect(() => validateImageUrl('data:image/png;base64,iVBORw0KG...')).toThrow(MapyGarminError);
    });

    it('should reject blob: URLs', () => {
      expect(() => validateImageUrl('blob:https://example.com/123')).toThrow(MapyGarminError);
    });
  });

  describe('Garmin image URL validation', () => {
    it('should accept Garmin profile image URLs', () => {
      const url = 'https://static.garmin.com/profile/123/profileImage.jpg';
      expect(validateImageUrl(url, ['garmin.com', 'amazonaws.com'])).toBe(url);
    });

    it('should accept AWS S3 URLs for Garmin images', () => {
      const url = 'https://s3.amazonaws.com/garmin-connect-prod/profile/123.jpg';
      expect(validateImageUrl(url, ['garmin.com', 'amazonaws.com'])).toBe(url);
    });

    it('should reject images from non-whitelisted domains', () => {
      expect(() => validateImageUrl('https://evil.com/fake-avatar.jpg', ['garmin.com'])).toThrow(MapyGarminError);
    });
  });

  describe('edge cases', () => {
    it('should reject empty string', () => {
      expect(() => validateImageUrl('')).toThrow(MapyGarminError);
    });

    it('should reject malformed URLs', () => {
      expect(() => validateImageUrl('not-a-url.jpg')).toThrow(MapyGarminError);
    });

    it('should handle query parameters in image URLs', () => {
      const url = 'https://example.com/image.jpg?size=large&format=png';
      expect(validateImageUrl(url)).toBe(url);
    });

    it('should reject URLs with credentials', () => {
      expect(() => validateImageUrl('https://user:pass@example.com/image.jpg')).toThrow(MapyGarminError);
    });
  });

  describe('error handling', () => {
    it('should throw MapyGarminError with URL_VALIDATION error code', () => {
      try {
        validateImageUrl('javascript:alert(1)');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MapyGarminError);
        expect((error as MapyGarminError).code).toBe('URL_VALIDATION');
      }
    });
  });
});
