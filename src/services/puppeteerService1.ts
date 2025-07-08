/// <reference lib="dom" />
import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import AnonymizeUAPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import logger from '../utils/logger';
import { SamsungPageState } from '../types';
import { createSamsungMonitor } from './samsungMonitorService1';
import { Socket } from 'socket.io-client';
// Initialize plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(AnonymizeUAPlugin());

export const browsers: Map<string, PuppeteerService> = new Map();
export let activeBrowser: PuppeteerService | null = null;

export function getActiveBrowser() {
    return activeBrowser;
}

export function setActiveBrowser(browser: PuppeteerService) {
    activeBrowser = browser;
}


export class PuppeteerService {

    private browser: any;
    private page: any;
    private readonly SAMSUNG_URL = 'https://smartthingsfind.samsung.com/';
    private readonly profileName: string;
    private readonly profileDir: string;
    private monitor: ReturnType<typeof createSamsungMonitor> | null = null;
    public initialEmail: string | null = null;


    constructor(profileName: string, initialEmail?: string) {
        this.browser = null;
        this.page = null;
        this.profileName = profileName;
        this.profileDir = path.join(__dirname, '..', '..', 'chrome-profiles', profileName);
        this.initialEmail = initialEmail ?? null;
    }

    async start() {
        try {
            if (activeBrowser) {
                await activeBrowser.minimizeBrowser();
            }
            activeBrowser = this;

            // Check if profile directory exists
            if (await fs.stat(this.profileDir).catch(() => false)) {
                await fs.rm(this.profileDir, { recursive: true, force: true });
            }

            // Ensure profile directory exists
            await fs.mkdir(this.profileDir, { recursive: true });
            logger.info(`Using Chrome profile: ${this.profileName}`);

            this.browser = await puppeteer.launch({
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
                    `--profile-directory=${this.profileName}`,  // Use a separate profile for automation
                    '--password-store=basic',
                    '--disable-save-password-bubble', // Disables the save password prompt
                    '--password-manager-enabled=false', // Disables password manager entirely
                    '--disable-features=PasswordLeakDetection' // Disables password leak detection
                ],
                defaultViewport: null,
                ignoreDefaultArgs: ['--enable-automation'],
                userDataDir: this.profileDir,  // Persistent but separate from your main profile
                executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            });

            this.page = await this.browser.newPage();

            this.page.emulateTimezone('UTC');

            // Set longer timeout for navigation
            this.page.setDefaultNavigationTimeout(120000); // 2 minutes

            // Maximize the window after creation
            const session = await this.page.target().createCDPSession();
            const { windowId } = await session.send('Browser.getWindowForTarget');
            await session.send('Browser.setWindowBounds', {
                windowId,
                bounds: {
                    windowState: 'maximized'
                }
            });

            // More realistic user agent with platform info
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

            // Enhanced browser feature emulation
            await this.page.evaluateOnNewDocument(() => {
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
            await this.page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            });

            // Enable JavaScript and cookies
            await this.page.setJavaScriptEnabled(true);
            await this.page.setCacheEnabled(true);

            // Add styles to make content fill the browser window
            await this.page.evaluate(() => {
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


            await this.loadPage(this.SAMSUNG_URL);
            logger.info(`Browser started successfully with profile: ${this.profileName}`);
        } catch (error) {
            logger.error(`Error starting browser with profile ${this.profileName}:`, error);
        }
    }



    async loadPage(url: string) {
        await this.page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 120000
        });
    }

    async getDOM() {
        return await this.page.evaluate(() => {
            return {
                document: document,
                url: window.location.href
            };
        });
    }

    getBrowser() {
        return this.browser;
    }

    getPage() {
        return this.page;
    }



    async querySelector(selector: string) {
        return await this.page.evaluate((sel: string) => {
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

    async querySelectorAll(selector: string) {
        return await this.page.evaluate((sel: string) => {
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

    async getSignInBtnPos() {
        return await this.page.evaluate(() => {
            const signInButton = Array.from(document.querySelectorAll('button')).find(
                button => button.textContent?.trim() === 'Sign in'
            );
            if (!signInButton) return null;

            const rect = signInButton.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const x = window.screenX + window.outerWidth - window.innerWidth + rect.x;
            const y = window.screenY + window.outerHeight - window.innerHeight + rect.y;
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            return {
                width, height, centerX, centerY, x, y
            };
        });
    }

    async getEmailInputPos() {
        return await this.page.evaluate(() => {
            const emailInput = document.querySelector('#account');
            if (!emailInput) return null;

            const rect = emailInput.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const x = window.screenX + window.outerWidth - window.innerWidth + rect.x;
            const y = window.screenY + window.outerHeight - window.innerHeight + rect.y;
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            return {
                width, height, centerX, centerY, x, y
            };
        });
    }

    async getPasswordInputPos() {
        return await this.page.evaluate(() => {
            const passwordInput = document.querySelector('#password');
            if (!passwordInput) return null;

            const rect = passwordInput.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const x = window.screenX + window.outerWidth - window.innerWidth + rect.x;
            const y = window.screenY + window.outerHeight - window.innerHeight + rect.y;
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            return {
                width, height, centerX, centerY, x, y
            };
        });
    }

    async getNextBtnPos() {
        return await this.page.evaluate(() => {
            const signInButton = Array.from(document.querySelectorAll('button')).find(
                button => button.textContent?.trim() === 'Next'
            );
            if (!signInButton) return null;

            const rect = signInButton.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const x = window.screenX + window.outerWidth - window.innerWidth + rect.x;
            const y = window.screenY + window.outerHeight - window.innerHeight + rect.y;
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            return {
                width, height, centerX, centerY, x, y
            };
        });
    }

    async checkCaptcha() {
        if (this.browser === null || this.page === null) return false;

        try {
            // Get all iframes
            const iframes = await this.page.$$('iframe');

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

    async getTagNoticePos() {
        return await this.page.evaluate(() => {
            const pElems = Array.from(document.querySelectorAll('h4'));
            const noticeElem = pElems.find(p => p.textContent?.trim() === "Notice") || null;
            if (noticeElem) {
                const btns = Array.from(document.querySelectorAll('button'));
                const okBtn = btns.find(btn => btn.textContent?.trim() === "OK") || null;
                if (okBtn) {
                    const rect = okBtn.getBoundingClientRect();
                    const width = rect.width;
                    const height = rect.height;
                    const x = window.screenX + window.outerWidth - window.innerWidth + rect.x;
                    const y = window.screenY + window.outerHeight - window.innerHeight + rect.y;
                    const centerX = x + width / 2;
                    const centerY = y + height / 2;
                    return {
                        width, height, centerX, centerY, x, y
                    };
                }
                return null;
            }
            return null;
        });
    }

    async getNotifySettingRadioBtnPos() {
        return await this.page.evaluate(() => {
            const pElems = Array.from(document.querySelectorAll('p'));
            const noticeElem = pElems.find(p => p.textContent?.trim() === "Notify me when it's found") || null;
            if (noticeElem) {
                const radioBtn = noticeElem.nextElementSibling?.querySelector('div') || null;
                if (radioBtn) {
                    const rect = radioBtn.getBoundingClientRect();
                    const width = rect.width;
                    const height = rect.height;
                    const x = window.screenX + window.outerWidth - window.innerWidth + rect.x;
                    const y = window.screenY + window.outerHeight - window.innerHeight + rect.y;
                    const centerX = x + width / 2;
                    const centerY = y + height / 2;
                    return {
                        width, height, centerX, centerY, x, y
                    };
                }
                return null;
            }
            return null;
        });
    }

    async checkNotifyEmailExists() {
        return await this.page.evaluate(() => {
            const pElems = Array.from(document.querySelectorAll('p'));
            const noticeElem = pElems.find(p => p.textContent?.trim() === "Notify me when it's found") || null;
            if (noticeElem) {
                const divElem = noticeElem.nextElementSibling;
                if (divElem && divElem.classList.contains('bg-gray-400')) {
                    return false;
                }
                return true;
            }
            return false;
        });
    }

    async getNotifyEmailInputPos() {
        return await this.page.evaluate(() => {
            const inputElems = Array.from(document.querySelectorAll('input'));
            const emailInput = inputElems.find(input => input.placeholder === 'Enter your email address') || null;
            if (!emailInput) return null;
            const rect = emailInput.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const x = window.screenX + window.outerWidth - window.innerWidth + rect.x;
            const y = window.screenY + window.outerHeight - window.innerHeight + rect.y;
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            return {
                width, height, centerX, centerY, x, y
            };
        });
    }

    async getNotifyEmailEnterBtnPos() {
        return await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const turnOnBtn = buttons.find(btn => btn.textContent?.trim() === 'Turn on') || null;
            if (!turnOnBtn) return null;
            const rect = turnOnBtn.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const x = window.screenX + window.outerWidth - window.innerWidth + rect.x;
            const y = window.screenY + window.outerHeight - window.innerHeight + rect.y;
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            return {
                width, height, centerX, centerY, x, y
            };
        });
    }



    async getNotNowBtnPos() {
        return await this.page.evaluate(() => {
            const notNowBtn = Array.from(document.querySelectorAll('button')).find(
                button => button.textContent?.trim() === 'Not now'
            );
            if (!notNowBtn) return null;

            const rect = notNowBtn.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const x = window.screenX + window.outerWidth - window.innerWidth + rect.x;
            const y = window.screenY + window.outerHeight - window.innerHeight + rect.y;
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            return {
                width, height, centerX, centerY, x, y
            };
        });
    }

    async deviceIsTracked() {
        return await this.page.evaluate(() => {
            const element = document.querySelector('#marker-3');
            return element !== null;
        });
    }

    async getLastUpdatedTime() {
        return await this.page.evaluate(() => {
            const element = document.querySelector('#marker-3');
            if (!element) return null;
            const timeElem = element.querySelector('div')?.querySelector('div')?.querySelector('p');
            if (!timeElem) return null;

            // const time = timeElem.textContent?.trim();
            // return time;

            const currentYear = new Date().getFullYear();

            const timeText = timeElem.textContent?.trim();
            if (!timeText) return null;

            let cleanTimeText = timeText.replace(/(\d+)(st|nd|rd|th)/, "$1");

            if (!/\d{4}/.test(cleanTimeText)) {
                cleanTimeText += `, ${currentYear}`;
            }
            const parsedDate = new Date(Date.parse(cleanTimeText + " UTC"));

            return parsedDate.toISOString();

            // Parse the time string "Mar 10th, 4:34 PM"
            // const [datePart, timePart] = timeText.split(', ');
            // if (!datePart || !timePart) return null;

            // // Parse month
            // const month = datePart.substring(0, 3);
            // const monthMap: { [key: string]: string } = {
            //     'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            //     'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            //     'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
            // };

            // // Parse day
            // const day = datePart.match(/\d+/)?.[0]?.padStart(2, '0');
            // if (!day) return null;

            // // Parse time
            // const [timeStr, meridiem] = timePart.split(' ');
            // const [hours, minutes] = timeStr.split(':');
            // if (!hours || !minutes) return null;

            // // Convert to 24-hour format
            // let hour = parseInt(hours);
            // if (meridiem === 'PM' && hour !== 12) hour += 12;
            // if (meridiem === 'AM' && hour === 12) hour = 0;

            // // Get current year (since the original format doesn't include year)
            // const year = new Date().getFullYear();

            // const dateTime = new Date(year, parseInt(monthMap[month]) - 1, parseInt(day), parseInt(hours), parseInt(minutes), 0);
            // return dateTime.toLocaleString();

            // // Create ISO datetime string
            // const dateTimeStr = `${year}-${monthMap[month]}-${day}T${hour.toString().padStart(2, '0')}:${minutes}:00`;
            // return new Date(dateTimeStr).toISOString();
        });
    }

    async getEmailInPasswordPage() {
        if (this.browser === null || this.page === null) return null;

        const email = await this.page.evaluate(() => {
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

    async getDeviceList() {
        if (this.browser === null || this.page === null) return [];

        return await this.page.evaluate(() => {
            const deviceListContainer = document.querySelector('#deviceList');
            if (deviceListContainer) {
                const deviceLists = Array.from(deviceListContainer.querySelectorAll('li')).map(item => {
                    const deviceDiv = item.querySelector('div');
                    if (deviceDiv) {
                        const rect = deviceDiv.getBoundingClientRect();
                        const width = rect.width;
                        const height = rect.height;
                        const x = window.screenX + window.outerWidth - window.innerWidth + rect.x;
                        const y = window.screenY + window.outerHeight - window.innerHeight + rect.y;
                        const centerX = x + width / 2;
                        const centerY = y + height / 2;
                        const name = deviceDiv.textContent?.trim();
                        return {
                            width, height, centerX, centerY, x, y, name
                        };
                    }
                    return null;
                }).filter((device) => device !== null);
                return deviceLists;
            }
            return [];
        });
    }

    async scrollToDevice(deviceName: string) {
        if (this.browser === null || this.page === null) return;

        try {
            await this.page.evaluate((name: string) => {
                const deviceListContainer = document.querySelector('#deviceList');
                if (!deviceListContainer) return;

                const deviceElements = Array.from(deviceListContainer.querySelectorAll('li'));
                const targetDevice = deviceElements.find(item => {
                    const deviceDiv = item.querySelector('div');
                    return deviceDiv?.textContent?.trim() === name;
                });

                if (targetDevice) {
                    targetDevice.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest'
                    });
                }
            }, deviceName);

            logger.info(`Scrolled to device: ${deviceName}`);
        } catch (error) {
            logger.error(`Error scrolling to device ${deviceName}:`, error);
        }
    }

    async getCurrentLocation() {
        if (this.browser === null || this.page === null) return null;

        return await this.page.evaluate(() => {
            const currentLocationLink = document.querySelector('[title="Open this area in Google Maps (opens a new window)"]');
            if (currentLocationLink) {
                const url = currentLocationLink.getAttribute('href');
                return url;
            }
            return null;
        });
    }

    async getCurrentPageState(): Promise<SamsungPageState> {
        if (this.browser === null || this.page === null) return SamsungPageState.UNKNOWN;

        try {
            const pageUrl = await this.page.url();

            // Check for Initial page
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

            // Check for Email input page
            const emailInput = await this.getEmailInputPos();
            const nextButton = await this.getNextBtnPos();
            if (emailInput && nextButton) {
                return SamsungPageState.EMAIL_INPUT;
            }

            // Check for Password input page
            const passwordInput = await this.getPasswordInputPos();
            const signInButton = await this.getSignInBtnPos();
            if (passwordInput && signInButton) {
                return SamsungPageState.PASSWORD_INPUT;
            }

            return SamsungPageState.UNKNOWN;
        } catch (error) {
            logger.error('Error getting current page state:', error);
            return SamsungPageState.UNKNOWN;
        }
    }

    async reloadPage() {
        try {
            if (this.page) {
                await this.page.reload({ waitUntil: 'networkidle0' });
                logger.info('Page reloaded successfully');
            }
        } catch (error) {
            logger.error('Error reloading page:', error);
        }
    }

    async restartBrowser() {
        try {
            await this.close();
            try {
                await fs.rm(this.profileDir, { recursive: true, force: true });
                logger.info(`Removed Chrome profile: ${this.profileName}`);
            } catch (error) {
                logger.error(`Error removing Chrome profile ${this.profileName}:`, error);
            }
            await this.start();
            logger.info(`Browser restarted successfully with profile: ${this.profileName}`);
        } catch (error) {
            logger.error(`Error restarting browser with profile ${this.profileName}:`, error);
        }
    }

    async bringToFront() {
        if (this.page) {
            await this.page.bringToFront();
        }
    }

    async close() {
        try {
            this.stopMonitor();
            if (this.browser) {

                await this.browser.close();
                await fs.rm(this.profileDir, { recursive: true, force: true });
                this.browser = null;
                this.page = null;
                logger.info(`Browser closed for profile: ${this.profileName}`);
            }
        } catch (error) {
            logger.error(`Error closing browser for profile ${this.profileName}:`, error);
        }
    }

    getProfileName(): string {
        return this.profileName;
    }

    async startMonitor(socket: Socket) {
        this.monitor = createSamsungMonitor(this, (status) => {
            if (socket) {
                socket.emit('samsung_site_status_update', {
                    profileName: this.profileName,
                    status: status
                });
            }
        });
        await this.monitor.start();
    }

    stopMonitor() {
        if (this.monitor) {
            this.monitor.stop();
            this.monitor = null;
        }
    }

    async maximizeBrowser() {
        try {
            if (this.page) {
                const session = await this.page.target().createCDPSession();
                const { windowId } = await session.send('Browser.getWindowForTarget');

                // First restore to normal state
                await session.send('Browser.setWindowBounds', {
                    windowId,
                    bounds: { windowState: 'normal' }
                });

                // Wait a bit for the window to restore
                await new Promise(resolve => setTimeout(resolve, 100));

                // Then maximize
                await session.send('Browser.setWindowBounds', {
                    windowId,
                    bounds: { windowState: 'maximized' }
                });

                logger.info(`Browser window maximized for profile: ${this.profileName}`);
            }
        } catch (error) {
            logger.error(`Error maximizing browser window for profile ${this.profileName}:`, error);
        }
    }

    async minimizeBrowser() {
        try {
            if (this.page) {
                const session = await this.page.target().createCDPSession();
                const { windowId } = await session.send('Browser.getWindowForTarget');

                // First restore to normal state
                await session.send('Browser.setWindowBounds', {
                    windowId,
                    bounds: { windowState: 'normal' }
                });

                // Wait a bit for the window to restore
                await new Promise(resolve => setTimeout(resolve, 100));

                // Then minimize
                await session.send('Browser.setWindowBounds', {
                    windowId,
                    bounds: { windowState: 'minimized' }
                });

                logger.info(`Browser window minimized for profile: ${this.profileName}`);
            }
        } catch (error) {
            logger.error(`Error minimizing browser window for profile ${this.profileName}:`, error);
        }
    }

    async setWindowState(state: 'maximized' | 'minimized' | 'normal') {
        try {
            if (this.page) {
                const session = await this.page.target().createCDPSession();
                const { windowId } = await session.send('Browser.getWindowForTarget');

                // Always restore to normal state first
                if (state !== 'normal') {
                    await session.send('Browser.setWindowBounds', {
                        windowId,
                        bounds: { windowState: 'normal' }
                    });

                    // Wait a bit for the window to restore
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Set to desired state
                await session.send('Browser.setWindowBounds', {
                    windowId,
                    bounds: { windowState: state }
                });

                logger.info(`Browser window set to ${state} for profile: ${this.profileName}`);
            }
        } catch (error) {
            logger.error(`Error setting browser window state to ${state} for profile ${this.profileName}:`, error);
        }
    }
}

// Create factory function instead of singleton
export const createPuppeteerService = (profileName: string, initialEmail?: string) => {
    return new PuppeteerService(profileName, initialEmail);
};
