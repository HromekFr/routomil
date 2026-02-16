/**
 * Integration tests for Chrome Extension
 *
 * These tests verify that the built extension can load properly
 * without runtime errors. They catch issues like:
 * - Invalid JavaScript syntax in bundles
 * - Missing global objects (module, require, etc.)
 * - Manifest validation errors
 * - Service worker registration issues
 *
 * Run with: npm run test:integration
 */

const fs = require('fs');
const path = require('path');

describe('Chrome Extension Integration Tests', () => {
  const distPath = path.join(__dirname, '..', 'dist');

  beforeAll(() => {
    // Ensure dist directory exists
    if (!fs.existsSync(distPath)) {
      throw new Error('dist/ directory not found. Run "npm run build" first.');
    }
  });

  describe('Build Artifacts', () => {
    test('dist directory contains all required files', () => {
      const requiredFiles = [
        'manifest.json',
        'service-worker.js',
        'mapy-content.js',
        'popup.js',
        'popup.html',
        'popup.css',
        'mapy-content.css',
      ];

      requiredFiles.forEach(file => {
        const filePath = path.join(distPath, file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    test('all JavaScript bundles are non-empty', () => {
      const jsFiles = ['service-worker.js', 'mapy-content.js', 'popup.js'];

      jsFiles.forEach(file => {
        const filePath = path.join(distPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Manifest Validation', () => {
    let manifest;

    beforeAll(() => {
      const manifestPath = path.join(distPath, 'manifest.json');
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(manifestContent);
    });

    test('manifest.json is valid JSON', () => {
      expect(manifest).toBeDefined();
      expect(typeof manifest).toBe('object');
    });

    test('manifest has required fields', () => {
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.name).toBeDefined();
      expect(manifest.version).toBeDefined();
      expect(manifest.description).toBeDefined();
    });

    test('service worker is properly configured', () => {
      expect(manifest.background).toBeDefined();
      expect(manifest.background.service_worker).toBe('service-worker.js');
      // Note: MV3 service workers don't require type: "module"
    });

    test('content scripts are properly configured', () => {
      expect(manifest.content_scripts).toBeDefined();
      expect(Array.isArray(manifest.content_scripts)).toBe(true);
      expect(manifest.content_scripts.length).toBeGreaterThan(0);

      const mapyContent = manifest.content_scripts[0];
      expect(mapyContent.matches).toContain('https://mapy.cz/*');
      expect(mapyContent.js).toContain('mapy-content.js');
    });

    test('permissions are declared', () => {
      expect(manifest.permissions).toBeDefined();
      expect(Array.isArray(manifest.permissions)).toBe(true);
    });
  });

  describe('JavaScript Bundle Validation', () => {
    test('service-worker.js does not contain CommonJS exports', () => {
      const content = fs.readFileSync(path.join(distPath, 'service-worker.js'), 'utf-8');

      // Should NOT have module.exports or require()
      expect(content).not.toContain('module.exports');
      expect(content).not.toContain('exports.default');

      // Should be wrapped in IIFE for browser context
      expect(content).toMatch(/^\(\(\)=>/);
    });

    test('mapy-content.js does not contain CommonJS exports', () => {
      const content = fs.readFileSync(path.join(distPath, 'mapy-content.js'), 'utf-8');

      expect(content).not.toContain('module.exports');
      expect(content).not.toContain('exports.default');
      expect(content).toMatch(/^\(\(\)=>/);
    });

    test('popup.js does not contain CommonJS exports', () => {
      const content = fs.readFileSync(path.join(distPath, 'popup.js'), 'utf-8');

      expect(content).not.toContain('module.exports');
      expect(content).not.toContain('exports.default');
      expect(content).toMatch(/^\(\(\)=>/);
    });

    test('bundles do not reference Node.js globals', () => {
      const bundles = ['service-worker.js', 'mapy-content.js', 'popup.js'];

      bundles.forEach(file => {
        const content = fs.readFileSync(path.join(distPath, file), 'utf-8');

        // Should not reference Node.js globals (except in comments/strings)
        // This is a heuristic check - may need adjustment
        const lines = content.split('\n').filter(line =>
          !line.trim().startsWith('//') && !line.includes('sourceMappingURL')
        );
        const code = lines.join('\n');

        // Check for problematic patterns
        expect(code).not.toMatch(/\bprocess\.env\b/);
        expect(code).not.toMatch(/\brequire\s*\(/);
        expect(code).not.toMatch(/\b__dirname\b/);
        expect(code).not.toMatch(/\b__filename\b/);
      });
    });
  });

  describe('Service Worker Syntax Validation', () => {
    test('service-worker.js can be parsed as valid JavaScript', () => {
      const content = fs.readFileSync(path.join(distPath, 'service-worker.js'), 'utf-8');

      // Try to parse it - will throw if syntax is invalid
      expect(() => {
        new Function(content);
      }).not.toThrow();
    });

    test('service-worker.js contains expected extension lifecycle hooks', () => {
      const content = fs.readFileSync(path.join(distPath, 'service-worker.js'), 'utf-8');

      // Should have chrome.runtime message listener (required)
      expect(content).toContain('chrome.runtime.onMessage');

      // May have other listeners (downloads, etc.)
      expect(content).toMatch(/chrome\.(runtime|downloads|storage)/);
    });
  });

  describe('Content Script Validation', () => {
    test('mapy-content.js can be parsed as valid JavaScript', () => {
      const content = fs.readFileSync(path.join(distPath, 'mapy-content.js'), 'utf-8');

      expect(() => {
        new Function(content);
      }).not.toThrow();
    });

    test('mapy-content.js contains message listener', () => {
      const content = fs.readFileSync(path.join(distPath, 'mapy-content.js'), 'utf-8');

      expect(content).toContain('chrome.runtime.onMessage');
    });
  });

  describe('Popup Validation', () => {
    test('popup.js can be parsed as valid JavaScript', () => {
      const content = fs.readFileSync(path.join(distPath, 'popup.js'), 'utf-8');

      expect(() => {
        new Function(content);
      }).not.toThrow();
    });

    test('popup.html is valid HTML', () => {
      const content = fs.readFileSync(path.join(distPath, 'popup.html'), 'utf-8');

      // Basic HTML validation
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('<html');
      expect(content).toContain('</html>');
      expect(content).toContain('<body');
      expect(content).toContain('</body>');
    });

    test('popup.html references popup.js and popup.css', () => {
      const content = fs.readFileSync(path.join(distPath, 'popup.html'), 'utf-8');

      expect(content).toContain('popup.js');
      expect(content).toContain('popup.css');
    });
  });

  describe('Source Maps', () => {
    test('source maps are generated for debugging', () => {
      const mapFiles = [
        'service-worker.js.map',
        'mapy-content.js.map',
        'popup.js.map',
      ];

      mapFiles.forEach(file => {
        const filePath = path.join(distPath, file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    test('JavaScript files reference their source maps', () => {
      const jsFiles = ['service-worker.js', 'mapy-content.js', 'popup.js'];

      jsFiles.forEach(file => {
        const content = fs.readFileSync(path.join(distPath, file), 'utf-8');
        expect(content).toContain(`//# sourceMappingURL=${file}.map`);
      });
    });
  });

  describe('Bundle Size Checks', () => {
    test('service-worker.js is within reasonable size', () => {
      const stats = fs.statSync(path.join(distPath, 'service-worker.js'));
      const sizeKB = stats.size / 1024;

      // Should be less than 50 KB (currently ~14 KB)
      expect(sizeKB).toBeLessThan(50);
      expect(sizeKB).toBeGreaterThan(5); // Should not be empty
    });

    test('total extension size is reasonable', () => {
      const files = fs.readdirSync(distPath, { recursive: true });
      let totalSize = 0;

      files.forEach(file => {
        const filePath = path.join(distPath, file);
        if (fs.statSync(filePath).isFile()) {
          totalSize += fs.statSync(filePath).size;
        }
      });

      const totalMB = totalSize / (1024 * 1024);

      // Should be less than 5 MB (Chrome extension size limit is 128 MB)
      expect(totalMB).toBeLessThan(5);
    });
  });
});
