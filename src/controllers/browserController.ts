import { Request, Response } from 'express';
import logger from '../utils/logger';
import { createPuppeteerService, browsers } from '../services/puppeteerService1';
import { getSocket } from '../services/websocketService';
import path from 'path';
import fs from 'fs/promises';

export async function addBrowserProfile(req: Request, res: Response) {
  try {
    const { profileName, profileId } = req.body;

    const newBrowser = createPuppeteerService(profileName);
    await newBrowser.start();
    browsers.set(profileId, newBrowser);
    const socket = getSocket();
    if (socket) {
      newBrowser.startMonitor(socket);
    }
    browsers.set(profileName, newBrowser);


    return res.status(200).json({
      status: 'success',
      message: 'Successfully added new browser profile'
    });
  } catch (error) {
    logger.error('Error adding new browser profile', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

export async function deleteProfile(req: Request, res: Response) {
    try {
        const { profileId } = req.body;
        const browser = browsers.get(profileId);
        
        if (!browser) {
            return res.status(404).json({
                status: 'error',
                message: 'Browser profile not found'
            });
        }

        // Close the browser instance
        await browser.close();
        
        // Remove from browsers map
        browsers.delete(profileId);

        // Delete profile directory
        const profileDir = path.join(__dirname, '..', '..', 'chrome-profiles', profileId);
        await fs.rm(profileDir, { recursive: true, force: true });

        logger.info(`Browser profile ${profileId} deleted successfully`);

        return res.status(200).json({
            status: 'success',
            message: 'Browser profile deleted successfully'
        });

    } catch (error) {
        logger.error('Error deleting browser profile:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
} 