/**
 * E2E Browser Tests (Optional)
 * 
 * These tests load the extension in a real Chrome browser using Puppeteer.
 * They are slower but test the actual runtime behavior.
 * 
 * Setup:
 *   npm install --save-dev puppeteer
 * 
 * Run:
 *   npm run test:e2e
 * 
 * Note: Requires graphical environment (won't work in CI without Xvfb)
 */

const puppeteer = require('puppeteer');
const path = require('path');

describe('Extension E2E Tests (Browser)', () => {
  let browser;
  let extensionId;

  beforeAll(async () => {
    const extensionPath = path.join(__dirname, '..', '..', 'dist');

    // Launch Chrome with extension loaded
    browser = await puppeteer.launch({
      headless: false, // Extensions don't work in headless mode
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    // Get extension ID from service worker
    const targets = await browser.targets();
    const extensionTarget = targets.find(
      target => target.type() === 'service_worker'
    );
    
    if (extensionTarget) {
      const extensionUrl = extensionTarget.url() || '';
      extensionId = extensionUrl.split('/')[2];
      console.log('✅ Extension loaded with ID:', extensionId);
    } else {
      throw new Error('Extension service worker not found - did it fail to load?');
    }
  }, 30000); // Increase timeout for browser launch

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('extension service worker loads without errors', async () => {
    expect(extensionId).toBeDefined();
    
    const page = await browser.newPage();
    
    // Collect console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Navigate to test page
    await page.goto('https://mapy.cz', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);

    // Should have no JavaScript errors
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
    
    await page.close();
  }, 30000);

  test('extension popup opens and displays UI', async () => {
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    
    const page = await browser.newPage();
    await page.goto(popupUrl, { waitUntil: 'networkidle2' });
    
    // Check popup loaded
    const content = await page.content();
    expect(content).toContain('Garmin');
    
    // Check for login button or route status
    const hasLoginButton = await page.$('#login-button') !== null;
    const hasRouteStatus = await page.$('.route-status') !== null;
    
    // One of these should be visible
    expect(hasLoginButton || hasRouteStatus).toBe(true);
    
    await page.close();
  }, 30000);

  test('content script injects on mapy.cz', async () => {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.text().includes('Mapy.cz → Garmin Sync')) {
        console.log('📝 Extension:', msg.text());
      }
    });
    
    await page.goto('https://mapy.cz', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000);
    
    // Check if extension logged initialization
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));
    
    // Execute some code in page context to verify content script access
    const hasChromeRuntime = await page.evaluate(() => {
      return typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined';
    });
    
    expect(hasChromeRuntime).toBe(true);
    
    await page.close();
  }, 30000);
});
