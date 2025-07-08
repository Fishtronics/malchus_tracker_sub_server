import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import errorHandler from './middleware/errorHandler';
import samsungRoute from './routes/samsung';
import { initializeArduino } from './utils/usart';
import logger from './utils/logger';
import { startBrowser, closeBrowser, getDeviceList, getAccountStatus, restartBrowser } from './services/puppeteerService';
import { connectToCloudServer, getSocket } from './services/websocketService';
import cloudServer from './routes/cloudServer';
import browserRoute from './routes/browser';

const app = express();

app.use(express.json());

// Routes
app.use('/api/samsung', samsungRoute);
app.use('/api/cloudServer', cloudServer);
app.use('/api/browser', browserRoute);

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
const CLOUD_SERVER_URL = process.env.CLOUD_SERVER_URL || 'ws://localhost:3999';
const HOME_SERVER_ID = process.env.HOME_SERVER_ID;

async function startServer(): Promise<void> {
  try {
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
    await initializeArduino();

    setInterval(() => {
      if (getSocket() === null) {
        connectToCloudServer({
          cloudServerUrl: process.env.CLOUD_SERVER_URL || 'localhost:3999',
          name: process.env.HOME_SERVER_NAME || 'homeServer',
          password: process.env.HOME_SERVER_PASSWORD || 'homeServer'
        });
      }
    }, 10000);


    // Start browser
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
