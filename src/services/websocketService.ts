import { Socket, io as SocketClient } from 'socket.io-client';
import { SamsungSiteStatus } from '../types/puppeteer';
import { createSamsungMonitor } from './samsungMonitorService';
import logger from '../utils/logger';
import { SamsungPageState } from '../types';
import { browsers, createPuppeteerService } from './puppeteerService1';


interface ConnectionConfig {
  cloudServerUrl: string;
  name: string;
  password: string;
}

let socket: Socket | null = null;
let samsungMonitor: ReturnType<typeof createSamsungMonitor> | null = null;

export function connectToCloudServer(config: ConnectionConfig) {
  socket = SocketClient(config.cloudServerUrl + '/home-server', {
    auth: {
      name: config.name,
      password: config.password
    },
    reconnection: true,
    reconnectionDelay: 5000,
    reconnectionAttempts: Infinity
  });

  socket.on('connect', async () => {
    logger.info('Connected to cloud server');
    // Create monitor with sendStatus function
    // samsungMonitor = createSamsungMonitor(sendSamsungSiteStatus);
    // await samsungMonitor.start();
  });

  socket.on('browser_profiles', async (profiles) => {
    for (let profile of profiles) {
      const puppeteerService = createPuppeteerService(profile.name, profile.email);
      browsers.set(profile.id, puppeteerService);
      await puppeteerService.start();
      await puppeteerService.startMonitor(socket!);
    }
  })

  socket.on('disconnect', () => {
    logger.warn('Disconnected from cloud server');

    for(let key of browsers.keys()) {
      browsers.get(key)?.close();
      browsers.delete(key);
    }
    // samsungMonitor?.stop();

    // samsungMonitor = null;
  });

  socket.on('error', (error) => {
    logger.error('Socket error:', error);
  });

  // Handle authentication errors
  socket.on('connect_error', (error) => {
    if (error.message === 'Authentication failed: Invalid IP address') {
      logger.error('Authentication failed: Server IP not registered');
    } else {
      logger.error('Connection error:', error.message);
    }
    closeSocket();
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function closeSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
}

export function sendSamsungSiteStatus(status: SamsungSiteStatus) {
  if (socket?.connected) {
    socket.emit('samsung_site_status_update', status);
  }
}
