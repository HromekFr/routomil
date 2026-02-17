// Tests for Mapy.cz URL parser

import {
  splitRcToRg,
  parseMapyUrl,
  hasRouteParams,
  buildMapyExportUrl,
  MapyRouteParams,
} from '../src/lib/mapy-url-parser';

describe('mapy-url-parser', () => {
  // Test data from test-mapy-export-api.js
  const TEST_URL = 'https://mapy.com/en/turisticka?planovani-trasy&rc=9hChxxXvtO95rPhx1qo5&rs=muni&rs=muni&ri=3468&ri=1818&mrp=%7B%22c%22%3A121%2C%22dt%22%3A%22%22%2C%22d%22%3Atrue%7D&xc=%5B%5D&rwp=1%3B9hSCBxYCBz9hje0xYNZD9hxS.xYg4DlhdxZAUp95R9hxZSY695frPxZhW5it4x-DpIkBrx-dKEmkRx10HRip2x1Viq';

  describe('splitRcToRg', () => {
    it('should split rc into 10-character chunks', () => {
      const rc = '9hChxxXvtO95rPhx1qo5';
      const result = splitRcToRg(rc);
      expect(result).toEqual(['9hChxxXvtO', '95rPhx1qo5']);
    });

    it('should handle rc with multiple chunks', () => {
      const rc = '9nTCQxXNc69nOAQxX2b29nMUQxWuoD9n8TQxW5wB9n-AQxWlSI';
      const result = splitRcToRg(rc);
      expect(result).toEqual([
        '9nTCQxXNc6',
        '9nOAQxX2b2',
        '9nMUQxWuoD',
        '9n8TQxW5wB',
        '9n-AQxWlSI',
      ]);
    });

    it('should handle rc shorter than 10 characters', () => {
      const rc = '9hChx';
      const result = splitRcToRg(rc);
      expect(result).toEqual(['9hChx']);
    });

    it('should handle empty rc', () => {
      const result = splitRcToRg('');
      expect(result).toEqual([]);
    });

    it('should handle rc with remainder not evenly divisible by 10', () => {
      const rc = '9hChxxXvtO95rPhx1'; // 17 characters
      const result = splitRcToRg(rc);
      expect(result).toEqual(['9hChxxXvtO', '95rPhx1']);
    });
  });

  describe('parseMapyUrl', () => {
    it('should parse test URL correctly', () => {
      const result = parseMapyUrl(TEST_URL);

      expect(result.rg).toEqual(['9hChxxXvtO', '95rPhx1qo5']);
      expect(result.rs).toEqual(['muni', 'muni']);
      expect(result.ri).toEqual(['3468', '1818']);
      expect(result.rp_c).toBe('121');
      expect(result.rp_aw).toBe('1;9hSCBxYCBz9hje0xYNZD9hxS.xYg4DlhdxZAUp95R9hxZSY695frPxZhW5it4x-DpIkBrx-dKEmkRx10HRip2x1Viq');
    });

    it('should parse mrp JSON and extract rp_c', () => {
      const url = 'https://mapy.com?rc=test&mrp=%7B%22c%22%3A121%7D';
      const result = parseMapyUrl(url);

      expect(result.rp_c).toBe('121');
    });

    it('should handle URL without mrp', () => {
      const url = 'https://mapy.com?rc=9hChxxXvtO95rPhx1qo5';
      const result = parseMapyUrl(url);

      expect(result.rg).toEqual(['9hChxxXvtO', '95rPhx1qo5']);
      expect(result.rp_c).toBeNull();
    });

    it('should handle URL without rwp', () => {
      const url = 'https://mapy.com?rc=9hChxxXvtO95rPhx1qo5';
      const result = parseMapyUrl(url);

      expect(result.rp_aw).toBeNull();
    });

    it('should extract rut parameter when present', () => {
      const url = 'https://mapy.com?rc=9gVJ8x1uBMhaqWi&rs=stre&rs=muni&ri=85610&ri=1665&rut=1';
      const result = parseMapyUrl(url);

      expect(result.rut).toBe('1');
    });

    it('should set rut to null when absent', () => {
      const url = 'https://mapy.com?rc=9hChxxXvtO95rPhx1qo5';
      const result = parseMapyUrl(url);

      expect(result.rut).toBeNull();
    });

    it('should handle URL with only minimal parameters', () => {
      const url = 'https://mapy.com?rc=testcoords';
      const result = parseMapyUrl(url);

      expect(result.rg).toEqual(['testcoords']);
      expect(result.rs).toEqual([]);
      expect(result.ri).toEqual([]);
      expect(result.rp_c).toBeNull();
      expect(result.rp_aw).toBeNull();
    });

    it('should handle invalid mrp JSON gracefully', () => {
      const url = 'https://mapy.com?rc=test&mrp=invalid-json';
      const result = parseMapyUrl(url);

      expect(result.rp_c).toBeNull();
    });

    it('should handle multiple rs and ri parameters', () => {
      const url = 'https://mapy.com?rc=test&rs=muni&rs=ward&rs=ward&ri=1&ri=2&ri=3';
      const result = parseMapyUrl(url);

      expect(result.rs).toEqual(['muni', 'ward', 'ward']);
      expect(result.ri).toEqual(['1', '2', '3']);
    });
  });

  describe('hasRouteParams', () => {
    it('should return true for URL with rc parameter', () => {
      const url = 'https://mapy.com?rc=9hChxxXvtO95rPhx1qo5';
      expect(hasRouteParams(url)).toBe(true);
    });

    it('should return true for URL with rg parameters', () => {
      const url = 'https://mapy.com?rg=9hChxxXvtO&rg=95rPhx1qo5';
      expect(hasRouteParams(url)).toBe(true);
    });

    it('should return false for URL without route parameters', () => {
      const url = 'https://mapy.com/en/turisticka';
      expect(hasRouteParams(url)).toBe(false);
    });

    it('should return false for invalid URL', () => {
      expect(hasRouteParams('not-a-url')).toBe(false);
    });

    it('should return true for test URL', () => {
      expect(hasRouteParams(TEST_URL)).toBe(true);
    });
  });

  describe('buildMapyExportUrl', () => {
    it('should build export URL with all parameters', () => {
      const params: MapyRouteParams = {
        rg: ['9hChxxXvtO', '95rPhx1qo5'],
        rs: ['muni', 'muni'],
        ri: ['3468', '1818'],
        rp_c: '121',
        rp_aw: '1;9hSCBxYCBz9hje0xYNZD9hxS.xYg4DlhdxZAUp95R9hxZSY695frPxZhW5it4x-DpIkBrx-dKEmkRx10HRip2x1Viq',
        rut: null,
      };

      const url = buildMapyExportUrl(params);
      const urlObj = new URL(url);

      expect(urlObj.origin).toBe('https://mapy.com');
      expect(urlObj.pathname).toBe('/api/tplannerexport');
      expect(urlObj.searchParams.get('export')).toBe('gpx');
      expect(urlObj.searchParams.get('lang')).toBe('en,cs');
      expect(urlObj.searchParams.get('rp_c')).toBe('121');
      expect(urlObj.searchParams.getAll('rg')).toEqual(['9hChxxXvtO', '95rPhx1qo5']);
      expect(urlObj.searchParams.getAll('rs')).toEqual(['muni', 'muni']);
      expect(urlObj.searchParams.getAll('ri')).toEqual(['3468', '1818']);
      expect(urlObj.searchParams.get('rp_aw')).toBe('1;9hSCBxYCBz9hje0xYNZD9hxS.xYg4DlhdxZAUp95R9hxZSY695frPxZhW5it4x-DpIkBrx-dKEmkRx10HRip2x1Viq');
      expect(urlObj.searchParams.has('rand')).toBe(true); // Cache buster
      expect(urlObj.searchParams.has('rut')).toBe(false); // Not present when null
    });

    it('should include rut in URL when present', () => {
      const params: MapyRouteParams = {
        rg: ['9gVJ8x1uBM', 'haqWi'],
        rs: ['stre', 'muni'],
        ri: ['85610', '1665'],
        rp_c: '132',
        rp_aw: '1;9gVW2x19rn',
        rut: '1',
      };

      const url = buildMapyExportUrl(params);
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('rut')).toBe('1');
    });

    it('should build export URL with minimal parameters', () => {
      const params: MapyRouteParams = {
        rg: ['9hChxxXvtO'],
        rs: [],
        ri: [],
        rp_c: null,
        rp_aw: null,
        rut: null,
      };

      const url = buildMapyExportUrl(params);
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('export')).toBe('gpx');
      expect(urlObj.searchParams.getAll('rg')).toEqual(['9hChxxXvtO']);
      expect(urlObj.searchParams.has('rp_c')).toBe(false);
      expect(urlObj.searchParams.has('rp_aw')).toBe(false);
    });

    it('should add cache buster parameter', () => {
      const params: MapyRouteParams = {
        rg: ['test'],
        rs: [],
        ri: [],
        rp_c: null,
        rp_aw: null,
        rut: null,
      };

      const url1 = buildMapyExportUrl(params);
      const url2 = buildMapyExportUrl(params);

      const rand1 = new URL(url1).searchParams.get('rand');
      const rand2 = new URL(url2).searchParams.get('rand');

      expect(rand1).not.toBeNull();
      expect(rand2).not.toBeNull();
      // Cache busters should be different (probabilistically)
      // We can't guarantee they're different due to random, but we can verify they exist
    });
  });

  describe('integration: parse and build', () => {
    it('should parse URL and rebuild export URL', () => {
      const params = parseMapyUrl(TEST_URL);
      const exportUrl = buildMapyExportUrl(params);
      const urlObj = new URL(exportUrl);

      expect(urlObj.searchParams.get('export')).toBe('gpx');
      expect(urlObj.searchParams.getAll('rg')).toEqual(params.rg);
      expect(urlObj.searchParams.getAll('rs')).toEqual(params.rs);
      expect(urlObj.searchParams.getAll('ri')).toEqual(params.ri);
      expect(urlObj.searchParams.get('rp_c')).toBe(params.rp_c);
      expect(urlObj.searchParams.get('rp_aw')).toBe(params.rp_aw);
      expect(urlObj.searchParams.get('rut')).toBe(params.rut);
    });
  });
});
