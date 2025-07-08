import { SamsungPageState, SamsungSiteStatus } from '../types/puppeteer';
import { PuppeteerService } from './puppeteerService1';
import logger from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

type SendStatusFn = (status: SamsungSiteStatus) => void;

export class SamsungMonitorService {
  private currentStatus: SamsungSiteStatus | null = null;
  private monitorInterval: NodeJS.Timer | null = null;
  private reloadInterval: NodeJS.Timer | null = null;
  private readonly MONITOR_INTERVAL = 1000; // 1 second
  private readonly RELOAD_INTERVAL = 10 * 60 * 1000; // 10 minutes

  constructor(
    private readonly puppeteerService: PuppeteerService,
    private readonly sendStatus: SendStatusFn
  ) {
  }

  async start() {
    logger.info(`Starting Samsung site monitor service for profile: ${this.puppeteerService.getProfileName()}`);
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

  private startReloadInterval() {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
    }

    this.reloadInterval = setInterval(async () => {
      try {
        const currentPage = await this.puppeteerService.getCurrentPageState();
        if (currentPage === SamsungPageState.MAIN_PAGE) {
          logger.info(`Reloading Samsung page for profile ${this.puppeteerService.getProfileName()} (10-minute interval)`);
          await this.puppeteerService.reloadPage();
        }
      } catch (error) {
        logger.error(`Error during scheduled page reload for profile ${this.puppeteerService.getProfileName()}:`, error);
      }
    }, this.RELOAD_INTERVAL);
  }

  private async checkAndUpdateStatus() {
    try {
      const currentPage = await this.puppeteerService.getCurrentPageState();
      const isCaptcha = await this.puppeteerService.checkCaptcha();

      let email: string | null = this.currentStatus?.email ?? this.puppeteerService.initialEmail;

      if (currentPage === SamsungPageState.PASSWORD_INPUT) {
        email = await this.puppeteerService.getEmailInPasswordPage();
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
        logger.info(`Captcha detected for profile ${this.puppeteerService.getProfileName()}, restarting browser`);
        // await this.puppeteerService.restartBrowser();
      }

      // Only send update if status has changed
      if (this.hasStatusChanged(newStatus)) {
        this.currentStatus = newStatus;
        this.sendStatus(newStatus);
        logger.info(`Samsung site status updated for profile ${this.puppeteerService.getProfileName()}:`, newStatus);
      }
    } catch (error) {
      logger.error(`Error checking Samsung site status for profile ${this.puppeteerService.getProfileName()}:`, error);
    }
  }

  private hasStatusChanged(newStatus: SamsungSiteStatus): boolean {
    if (!this.currentStatus) return true;

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
    logger.info(`Stopped Samsung site monitor service for profile ${this.puppeteerService.getProfileName()}`);
  }
}

// Create instance with browser instance and sendStatus function
export const createSamsungMonitor = (puppeteerService: PuppeteerService, sendStatus: SendStatusFn) => {
  return new SamsungMonitorService(puppeteerService, sendStatus);
}; 