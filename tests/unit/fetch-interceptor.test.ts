// Tests for the fetch-interceptor URL construction logic.
// Covers the delta-encoded rc decoding, rp_aw forwarding, and all URL parameters.

import { buildTplannerExportUrl, SMapCoordsStatic, SMapCoordsInstance } from '../../src/content/fetch-interceptor';
import { splitRcToRg } from '../../src/lib/mapy-url-parser';

// ---------------------------------------------------------------------------
// Real-world data captured from DevTools (2026-02-17)
// ---------------------------------------------------------------------------

// Case 1: named → coordinate → named
// rc has a 6-char delta chunk at position 20 (third waypoint, Hrabišín)
const CASE_MIXED_URL =
  'https://mapy.com/en/turisticka?planovani-trasy' +
  '&rc=9n6UvxXMp-9nUgtxXBwximCbK7' +
  '&rs=muni&rs=coor&rs=muni' +
  '&ri=166&ri=&ri=275' +
  '&mrp=%7B%22c%22%3A121%7D';

// Case 2: coordinate → coordinate
// rc has a 6-char delta chunk at position 10 (second waypoint)
// rwp is present → rp_aw must be forwarded
const CASE_COOR_URL =
  'https://mapy.com/en/turisticka?planovani-trasy' +
  '&rc=9naLtxXJkLg.0f1Z' +
  '&rs=coor&rs=coor' +
  '&ri=&ri=' +
  '&mrp=%7B%22c%22%3A121%7D' +
  '&rwp=1%3B9nayVxXJPFMuflE';

// ---------------------------------------------------------------------------
// Mock SMap.Coords — replays the real decoded values verified in DevTools
// ---------------------------------------------------------------------------

function makeMockSMap(
  decodeMap: Record<string, SMapCoordsInstance[]>
): SMapCoordsStatic {
  return {
    stringToCoords(rc: string): SMapCoordsInstance[] {
      if (!(rc in decodeMap)) throw new Error(`Unexpected rc: ${rc}`);
      return decodeMap[rc];
    },
    coordsToString(coords: SMapCoordsInstance[]): string {
      return (coords[0] as unknown as { _rg: string })._rg;
    },
  };
}

function fakeCoord(rg: string): SMapCoordsInstance {
  return { toWGS84: () => [0, 0], _rg: rg } as unknown as SMapCoordsInstance;
}

// Decoded rg values verified against live Mapy.cz DevTools session
const MIXED_SMAP = makeMockSMap({
  '9n6UvxXMp-9nUgtxXBwximCbK7': [
    fakeCoord('9n6UvxXMp-'), // Šumperk (absolute)
    fakeCoord('9nUgtxXBwx'), // coordinate pin (absolute)
    fakeCoord('9nYTvxWyHk'), // Hrabišín (decoded from delta 'imCbK7')
  ],
});

const COOR_SMAP = makeMockSMap({
  '9naLtxXJkLg.0f1Z': [
    fakeCoord('9naLtxXJkL'), // first pin (absolute)
    fakeCoord('9nbKtxXJKj'), // second pin (decoded from delta 'g.0f1Z')
  ],
});

// ---------------------------------------------------------------------------
// Helper: parse resulting URL
// ---------------------------------------------------------------------------

function parseResult(url: string) {
  const u = new URL(url);
  return {
    rg: u.searchParams.getAll('rg'),
    rs: u.searchParams.getAll('rs'),
    ri: u.searchParams.getAll('ri'),
    rp_c: u.searchParams.get('rp_c'),
    rp_aw: u.searchParams.get('rp_aw'),
    rut: u.searchParams.get('rut'),
    export: u.searchParams.get('export'),
    lang: u.searchParams.get('lang'),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildTplannerExportUrl', () => {
  describe('delta-encoded rc handling', () => {
    it('naïve 10-char split fails for delta-encoded rc — documents the original bug', () => {
      // rc = '9naLtxXJkLg.0f1Z' (18 chars)
      // Naïve split every 10 chars: ['9naLtxXJkL', 'g.0f1Z']
      // 'g.0f1Z' is a raw delta chunk, NOT a valid absolute rg — causes HTTP 500
      const naive = splitRcToRg('9naLtxXJkLg.0f1Z');
      expect(naive).toEqual(['9naLtxXJkL', 'g.0f1Z']);
      expect(naive[1]).not.toBe('9nbKtxXJKj'); // wrong: raw delta, not decoded
    });

    it('buildTplannerExportUrl decodes delta chunks to absolute rg values', () => {
      const result = parseResult(buildTplannerExportUrl(CASE_COOR_URL, COOR_SMAP));
      expect(result.rg).toEqual(['9naLtxXJkL', '9nbKtxXJKj']);
      // '9nbKtxXJKj' is the correctly decoded absolute value (not 'g.0f1Z')
    });

    it('decodes mixed route (named → coor → named) including delta third chunk', () => {
      const result = parseResult(buildTplannerExportUrl(CASE_MIXED_URL, MIXED_SMAP));
      expect(result.rg).toEqual(['9n6UvxXMp-', '9nUgtxXBwx', '9nYTvxWyHk']);
      // '9nYTvxWyHk' decoded from delta 'imCbK7'
    });
  });

  describe('rp_aw forwarding', () => {
    it('includes rp_aw when rwp is present in the page URL', () => {
      const result = parseResult(buildTplannerExportUrl(CASE_COOR_URL, COOR_SMAP));
      expect(result.rp_aw).toBe('1;9nayVxXJPFMuflE');
    });

    it('omits rp_aw when rwp is absent from the page URL', () => {
      const result = parseResult(buildTplannerExportUrl(CASE_MIXED_URL, MIXED_SMAP));
      expect(result.rp_aw).toBeNull();
    });
  });

  describe('parameter forwarding', () => {
    it('sets export=gpx and lang=en,cs', () => {
      const result = parseResult(buildTplannerExportUrl(CASE_MIXED_URL, MIXED_SMAP));
      expect(result.export).toBe('gpx');
      expect(result.lang).toBe('en,cs');
    });

    it('extracts rp_c from mrp.c', () => {
      const result = parseResult(buildTplannerExportUrl(CASE_MIXED_URL, MIXED_SMAP));
      expect(result.rp_c).toBe('121');
    });

    it('forwards rs and ri arrays in order', () => {
      const result = parseResult(buildTplannerExportUrl(CASE_MIXED_URL, MIXED_SMAP));
      expect(result.rs).toEqual(['muni', 'coor', 'muni']);
      expect(result.ri).toEqual(['166', '', '275']);
    });

    it('forwards rut when present', () => {
      const urlWithRut =
        CASE_MIXED_URL + '&rut=abc123';
      const result = parseResult(buildTplannerExportUrl(urlWithRut, MIXED_SMAP));
      expect(result.rut).toBe('abc123');
    });

    it('omits rut when absent', () => {
      const result = parseResult(buildTplannerExportUrl(CASE_MIXED_URL, MIXED_SMAP));
      expect(result.rut).toBeNull();
    });

    it('does not include rand (added separately by fetchGpxViaSMap)', () => {
      const url = buildTplannerExportUrl(CASE_MIXED_URL, MIXED_SMAP);
      expect(new URL(url).searchParams.has('rand')).toBe(false);
    });
  });

  describe('error cases', () => {
    it('throws when rc is missing from URL', () => {
      const noRc = 'https://mapy.com/en/turisticka?planovani-trasy&rs=muni&ri=1';
      expect(() => buildTplannerExportUrl(noRc, MIXED_SMAP)).toThrow(
        'No route found in URL (missing rc parameter)'
      );
    });

    it('throws when SMapCoords returns empty array', () => {
      const emptySMap: SMapCoordsStatic = {
        stringToCoords: () => [],
        coordsToString: () => '',
      };
      expect(() => buildTplannerExportUrl(CASE_MIXED_URL, emptySMap)).toThrow(
        'Could not decode route coordinates from rc parameter'
      );
    });
  });
});
