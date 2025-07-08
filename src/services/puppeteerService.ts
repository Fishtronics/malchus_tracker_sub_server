/// <reference lib="dom" />
import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import AnonymizeUAPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import logger from '../utils/logger';
import { SamsungPageState } from '../types';

// Initialize plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(AnonymizeUAPlugin());

let browser: any;
let page: any;

export async function initializePuppeteer() {
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--start-maximized',
        '--disable-notifications',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',  // Hide automation
        '--disable-infobars',                            // Remove "Chrome is being controlled by automation" banner
        '--window-position=0,0',                         // Position window at top-left
        '--ignore-certificate-errors',                   // Handle SSL certificates
        '--lang=en-US,en',                               // Set language
        '--enable-javascript',
        '--enable-cookies',
        '--enable-dom-storage',
        '--enable-webgl',
        '--enable-gpu',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--profile-directory=Profile 1'  // Use a separate profile for automation
      ],
      defaultViewport: null,
      ignoreDefaultArgs: ['--enable-automation'],
      userDataDir: './chrome-automation-profile',  // Persistent but separate from your main profile
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    });

    page = await browser.newPage();

    // Set longer timeout for navigation
    page.setDefaultNavigationTimeout(120000); // 2 minutes

    // Maximize the window after creation
    const session = await page.target().createCDPSession();
    const { windowId } = await session.send('Browser.getWindowForTarget');
    await session.send('Browser.setWindowBounds', {
      windowId,
      bounds: {
        windowState: 'maximized'
      }
    });

    // More realistic user agent with platform info
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    // Set timezone and locale
    await page.emulateTimezone('America/New_York');

    // Enhanced browser feature emulation
    await page.evaluateOnNewDocument(() => {
      // Hide webdriver
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

      // Add language preferences
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

      // Add fake plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          return {
            length: 5,
            item: () => ({
              description: "Portable Document Format",
              filename: "internal-pdf-viewer",
              name: "Chrome PDF Plugin"
            })
          };
        }
      });

      // Add Chrome specific properties
      Object.defineProperty(window, 'chrome', {
        get: () => ({
          runtime: {},
          app: {},
          loadTimes: () => { },
          csi: () => { },
          // Add other Chrome-specific properties as needed
        })
      });

      // Mock permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any): Promise<PermissionStatus> =>
        parameters.name === 'notifications'
          ? Promise.resolve({
            state: 'granted',
            name: parameters.name,
            onchange: null,
            addEventListener: () => { },
            removeEventListener: () => { },
            dispatchEvent: () => true
          } as PermissionStatus)
          : originalQuery(parameters);

      // Add WebGL support
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });

      // Mock canvas fingerprinting
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        contextId: string,
        options?: any
      ): RenderingContext | null {
        const context = getContext.call(this, contextId, options);
        if (context && contextId === '2d') {
          const ctx = context as CanvasRenderingContext2D;
          const getImageData = ctx.getImageData;
          ctx.getImageData = function (...args: Parameters<typeof getImageData>) {
            return getImageData.apply(this, args);
          };
        }
        return context;
      } as typeof HTMLCanvasElement.prototype.getContext;

      // Mock audio fingerprinting
      const audioContext = window.AudioContext || (window as any).webkitAudioContext;
      const origCreateOscillator = audioContext.prototype.createOscillator;
      audioContext.prototype.createOscillator = function () {
        const oscillator = origCreateOscillator.call(this);
        oscillator.start = () => { };
        return oscillator;
      };

      // Add more browser features
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50,
          downlink: 10,
          saveData: false
        })
      });

      // Mock battery API
      Object.defineProperty(navigator, 'getBattery', {
        get: () => () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 1,
          addEventListener: () => { },
          removeEventListener: () => { },
          dispatchEvent: () => true
        })
      });
    });

    // Set common headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });

    // Enable JavaScript and cookies
    await page.setJavaScriptEnabled(true);
    await page.setCacheEnabled(true);

    // Add styles to make content fill the browser window
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = `
        html, body {
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        #root, .app-container {  /* Adjust these selectors based on the website's structure */
          width: 100% !important;
          height: 100% !important;
          min-height: 100vh !important;
        }
      `;
      document.head.appendChild(style);
    });

    await page.goto('https://smartthingsfind.samsung.com/', {
      waitUntil: 'domcontentloaded', // Changed from networkidle0
      timeout: 120000 // 2 minutes
    });

    return { browser, page };
  } catch (error) {
    logger.error('Error initializing Puppeteer:', error);
    // throw error;
  }
}

export function getBrowser() {
  return browser;
}

export async function loadPage(url: string) {
  await page.goto(url, {
    waitUntil: 'domcontentloaded', // Changed from networkidle0
    timeout: 120000 // 2 minutes
  });
}

export async function getDOM() {
  return await page.evaluate(() => {
    return {
      document: document,
      url: window.location.href
    };
  });
}

export async function querySelector(selector: string) {
  return await page.evaluate((sel: string) => {
    const element = document.querySelector(sel);
    if (!element) return null;

    return {
      outerHTML: element.outerHTML,
      innerText: element.textContent,
      attributes: Array.from(element.attributes).map(attr => ({
        name: attr.name,
        value: attr.value
      }))
    };
  }, selector);
}

export async function querySelectorAll(selector: string) {
  return await page.evaluate((sel: string) => {
    const elements = Array.from(document.querySelectorAll(sel));
    return elements.map(element => ({
      outerHTML: element.outerHTML,
      innerText: element.textContent,
      attributes: Array.from(element.attributes).map(attr => ({
        name: attr.name,
        value: attr.value
      }))
    }));
  }, selector);
}

// Helper function to evaluate elements with properties
async function evaluateElement(selector: string) {
  if (!selector) return null;
  if (browser === null || page === null) return null;

  // await page.waitForNavigation({ 
  //   waitUntil: 'networkidle0',  // Wait until network is idle
  //   timeout: 5000  // 5 second timeout
  // }).catch(() => {
  //   // Ignore timeout - this means no navigation is happening
  //   logger.debug('No navigation occurring');
  //   return null;
  // });

  return await page.evaluate((sel: string) => {
    function getElementProperties(element: Element) {
      const rect = element.getBoundingClientRect();
      const x = window.screenX + window.outerWidth - window.innerWidth + rect.x;
      const y = window.screenY + window.outerHeight - window.innerHeight + rect.y;
      const width = rect.width;
      const height = rect.height;

      return {
        outerHTML: element.outerHTML,
        innerText: element.textContent?.trim(),
        attributes: Array.from(element.attributes).map(attr => ({
          name: attr.name,
          value: attr.value
        })),
        rect: {
          clientX: rect.x,
          clientY: rect.y,
          x,
          y,
          width,
          height,
          centerX: x + width / 2,
          centerY: y + height / 2
        },
        href: element.getAttribute('href')
      };
    }

    let element: Element | null;
    if (sel === "signInButton") {
      const buttons = Array.from(document.querySelectorAll('button'));
      element = buttons.find(button => button.textContent?.trim() === 'Sign in') || null;
    } else if (sel === "NextButton") {
      const buttons = Array.from(document.querySelectorAll('button'));
      element = buttons.find(button => button.textContent?.trim() === 'Next') || null;
    } else if (sel === "device-list") {
      const deviceListContainer = document.querySelector('#deviceList');
      if (deviceListContainer) {
        const deviceLists = Array.from(deviceListContainer.querySelectorAll('li')).map(item => {
          const deviceDiv = item.querySelector('div');
          if (deviceDiv) {
            return getElementProperties(deviceDiv);
          }
          return null;
        }).filter((device) => device !== null);
        return deviceLists;
      } else {
        return null;
      }
    } else if (sel === "currentLocation") {
      const currentLocation = document.querySelector('[title="Open this area in Google Maps (opens a new window)"]');
      if (currentLocation) {
        return getElementProperties(currentLocation);
      }
      return null;
    } else if (sel === "deviceChecking") {
      const pElems = Array.from(document.querySelectorAll('p'));
      element = pElems.find(p => p.textContent?.trim() === 'Checking location...') || null;
    } else if (sel === "deviceNotFound") {
      const pElems = Array.from(document.querySelectorAll('p'));
      element = pElems.find(p => p.textContent?.trim() === "Couldn't get location") || null;
    } else if (sel === "tagNotice") {
      const pElems = Array.from(document.querySelectorAll('h4'));
      const noticeElem = pElems.find(p => p.textContent?.trim() === "Notice") || null;
      if (noticeElem) {
        const btns = Array.from(document.querySelectorAll('button'));
        const okBtn = btns.find(btn => btn.textContent?.trim() === "OK") || null;
        element = okBtn;
      } else {
        element = null;
      }
    } else if (sel === "captcha") {
      const pElems = Array.from(document.querySelectorAll('label'));
      element = pElems.find(p => p.textContent?.trim() === "I'm not a robot") || null;
    } else {
      element = document.querySelector(sel);
    }

    if (!element) return null;
    return getElementProperties(element);
  }, selector);
}

export async function getSignInButton() {
  return evaluateElement("signInButton");
}

export async function getEmailInput() {
  return evaluateElement('#account');
}

export async function getNextButton() {
  return evaluateElement('NextButton');
}

export async function checkCaptcha() {
  if (browser === null || page === null) return false;

  try {
    // Get all iframes
    const iframes = await page.$$('iframe');

    // Check each iframe for the reCAPTCHA text
    for (const iframe of iframes) {
      try {
        // Get the frame handle
        const frame = await iframe.contentFrame();
        if (!frame) continue;

        // Check for the reCAPTCHA element
        const captchaElement = await frame.$('label');
        if (!captchaElement) continue;

        // Get the text content
        const text = await frame.evaluate((element: any) => element.textContent, captchaElement);

        // If we found the reCAPTCHA text
        if (text && text.includes("I'm not a robot")) {
          // Click the checkbox

          logger.info('Captcha found');
          return true;
        }
      } catch (frameError) {
        // Continue checking other iframes if one fails
        logger.debug('Error checking iframe:', frameError);
        continue;
      }
    }

    // No captcha found in any iframe
    return false;

  } catch (error) {
    logger.error('Error checking captcha:', error);
    return false;
  }
}

export async function getPasswordInput() {
  return evaluateElement('#password');
}

export async function getTagNotice() {
  return evaluateElement('tagNotice');
}

export async function getDeviceList() {
  return evaluateElement('device-list');
}

export async function isDeviceChecking() {
  const element = await evaluateElement('deviceChecking');
  return element !== null;
}

export async function getDeviceNotFound() {
  const element = await evaluateElement('deviceNotFound');
  return element !== null;
}

export async function getCurrentLocation() {
  const googleMapLink = await evaluateElement('currentLocation');
  if (googleMapLink) {
    return googleMapLink.href;
  }
  return null;
}

export async function deviceIsTracked() {
  const element = await evaluateElement('#marker-3');
  return element !== null;
}

export async function getEmailInPasswordPage() {
  if (page === null || browser === null) return null;

  const email = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const signInBtn = buttons.find(button => button.textContent?.trim() === 'Sign in') || null;
    if (signInBtn) {
      const sibling = signInBtn.parentElement?.parentElement;
      if (sibling) {
        const emailPElem = sibling.previousElementSibling?.querySelector('p');
        if (emailPElem) return emailPElem.textContent;
      }
    }
    return null;
  });
  return email;
}

export async function getCurrentPageState(): Promise<SamsungPageState> {
  if (!page) return SamsungPageState.UNKNOWN;

  try {

    // Check for Sign In button (Initial page)
    const pageUrl = await page.url();
    if (pageUrl === 'https://smartthingsfind.samsung.com/login') {
      return SamsungPageState.INITIAL;
    }

    // Check for Main page (after successful login)
    if (pageUrl === 'https://smartthingsfind.samsung.com/') {
      return SamsungPageState.MAIN_PAGE;
    }

    if (pageUrl === 'https://account.samsung.com/iam/signin/status/change-password') {
      return SamsungPageState.CHANGE_PASSWORD;
    }

    // Check for Email input
    const emailInput = await getEmailInput();
    const nextButton = await getNextButton();
    if (emailInput && nextButton) {
      return SamsungPageState.EMAIL_INPUT;
    }

    // Check for Password input
    const passwordInput = await getPasswordInput();
    const signInButton = await getSignInButton();
    if (passwordInput && signInButton) {
      return SamsungPageState.PASSWORD_INPUT;
    }

    return SamsungPageState.UNKNOWN;
  } catch (error) {
    logger.error('Error getting current page state:', error);
    return SamsungPageState.UNKNOWN;
  }
}

export async function getAccountStatus() {
  if (browser === null || page === null) return null;
  const pageUrl = await page.url();
  const isSigned = !pageUrl.includes('login');
  return {
    isSigned,
  };
}

export async function startBrowser() {
  try {
    if (browser) {
      return { browser, page };
    }
    return await initializePuppeteer();
  } catch (error) {
    throw new Error('Failed to start browser');
  }
}

export async function closeBrowser() {
  try {
    if (browser) {
      await browser.close();
      browser = null;
      page = null;
    }
  } catch (error) {
    throw new Error('Failed to close browser');
  }
}

export async function reloadPage() {
  try {
    if (page) {
      await page.reload({ waitUntil: 'networkidle0' });
      logger.info('Page reloaded successfully');
    }
  } catch (error) {
    logger.error('Error reloading page:', error);
    throw error;
  }
}

export async function restartBrowser() {
  try {
    await closeBrowser();
    try {
      const profilePath = path.join(__dirname, '..', '..', 'chrome-automation-profile');
      await fs.rm(profilePath, { recursive: true, force: true });
      logger.info('Removed Chrome profile directory');
    } catch (error) {
      logger.error('Error removing Chrome profile:', error);
    }
    await startBrowser();
    logger.info('Browser restarted successfully');
  } catch (error) {
    logger.error('Error restarting browser:', error);
  }
}

