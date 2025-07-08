import { SamsungPageState, SamsungSiteStatus } from '../types/puppeteer';
import { closeBrowser, checkCaptcha, getCurrentPageState, getDeviceList, getDeviceNotFound, isDeviceChecking, startBrowser, reloadPage, getEmailInput, getEmailInPasswordPage, restartBrowser } from './puppeteerService';
import logger from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

type SendStatusFn = (status: SamsungSiteStatus) => void;

class SamsungMonitorService {
  private currentStatus: SamsungSiteStatus | null = null;
  private monitorInterval: NodeJS.Timer | null = null;
  private reloadInterval: NodeJS.Timer | null = null;
  private readonly MONITOR_INTERVAL = 1000; // 1 second
  private readonly RELOAD_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private readonly STATUS_FILE_PATH = path.join(__dirname, '../../data/samsung-status.json');

  private sendStatus: SendStatusFn;

  constructor(sendStatus: SendStatusFn) {
    this.sendStatus = sendStatus;
  }

  async start() {
    logger.info('Starting Samsung site monitor service');

    // Load saved status
    await this.loadSavedStatus();

    // Initial status check and send
    await this.checkAndUpdateStatus();

    // Start periodic monitoring
    this.monitorInterval = setInterval(
      () => this.checkAndUpdateStatus(),
      this.MONITOR_INTERVAL
    );

    // Start page reload interval when signed in
    this.startReloadInterval();
  }

  private async loadSavedStatus() {
    try {
      await fs.mkdir(path.dirname(this.STATUS_FILE_PATH), { recursive: true });
      const data = await fs.readFile(this.STATUS_FILE_PATH, 'utf-8');
      this.currentStatus = JSON.parse(data);
      logger.info('Loaded saved Samsung site status:', this.currentStatus);
    } catch (error) {
      logger.info('No saved Samsung site status found, starting fresh');
      this.currentStatus = null;
    }
  }

  private async saveStatus(status: SamsungSiteStatus) {
    try {
      await fs.mkdir(path.dirname(this.STATUS_FILE_PATH), { recursive: true });
      await fs.writeFile(
        this.STATUS_FILE_PATH,
        JSON.stringify(status, null, 2),
        'utf-8'
      );
      logger.info('Saved Samsung site status');
    } catch (error) {
      logger.error('Error saving Samsung site status:', error);
    }
  }

  private startReloadInterval() {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
    }

    this.reloadInterval = setInterval(async () => {
      try {
        const currentPage = await getCurrentPageState();
        if (currentPage === SamsungPageState.MAIN_PAGE) {
          logger.info('Reloading Samsung page (10-minute interval)');
          await reloadPage();
        }
      } catch (error) {
        logger.error('Error during scheduled page reload:', error);
      }
    }, this.RELOAD_INTERVAL);
  }

  private async checkAndUpdateStatus() {
    try {
      const currentPage = await getCurrentPageState();
      const isCaptcha = await checkCaptcha();

      let email: string | null = this.currentStatus?.email ?? null;

      if (currentPage === SamsungPageState.PASSWORD_INPUT) {
        email = await getEmailInPasswordPage();
      } else if (currentPage === SamsungPageState.INITIAL || currentPage === SamsungPageState.EMAIL_INPUT) {
        email = null;
      }

      const newStatus: SamsungSiteStatus = {
        currentPage: currentPage,
        isSignedIn: currentPage === SamsungPageState.MAIN_PAGE,
        isCaptcha: isCaptcha,
        email: email
      };

      if (newStatus.isCaptcha) {
        logger.info('Captcha detected, restarting browser with fresh profile');
        // await restartBrowser();
      }

      // Only send update if status has changed
      if (this.hasStatusChanged(newStatus)) {
        this.currentStatus = newStatus;
        await this.saveStatus(newStatus); // Save the new status
        this.sendStatus(newStatus);
        logger.info('Samsung site status updated:', newStatus);
      }
    } catch (error) {
      logger.error('Error checking Samsung site status:', error);
    }
  }

  private hasStatusChanged(newStatus: SamsungSiteStatus): boolean {
    if (!this.currentStatus) return true;

    // Check all fields of SamsungSiteStatus
    return (
      this.currentStatus.currentPage !== newStatus.currentPage ||
      this.currentStatus.isSignedIn !== newStatus.isSignedIn ||
      this.currentStatus.isCaptcha !== newStatus.isCaptcha ||
      this.currentStatus.email !== newStatus.email
    );
  }

  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
      this.reloadInterval = null;
    }
    logger.info('Stopped Samsung site monitor service');
  }
}

// Create instance with sendStatus function when needed
export const createSamsungMonitor = (sendStatus: SendStatusFn) => {
  return new SamsungMonitorService(sendStatus);
}; 