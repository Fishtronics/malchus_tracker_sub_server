import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import logger from './logger';
import config from '../config';
import { ArduinoMessage, MSG_TYPES } from '../types';

let arduinoPort: SerialPort | null = null;

async function waitForMessage(
  parser: ReadlineParser, 
  expectedType?: string,
  timeout: number = 7000
): Promise<ArduinoMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for Arduino ${expectedType || 'response'}`));
    }, timeout);

    const messageHandler = (data: string) => {
      try {
        const message = JSON.parse(data) as ArduinoMessage;
        logger.debug('Received message:', message);
        if (!expectedType || message.type === expectedType) {
          cleanup();
          resolve(message);
        }
      } catch (error) {
        logger.error('Error parsing Arduino message:', error);
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      parser.removeListener('data', messageHandler);
    };

    parser.on('data', messageHandler);
  });
}

async function verifyArduinoPort(port: SerialPort): Promise<boolean> {
  try {
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
    
    // Send ping command
    port.write(JSON.stringify({ command: "ping" }) + '\n');

    // Wait for result
    const ack = await waitForMessage(parser, MSG_TYPES.ACK);
    if(!ack.success) {
      return false;
    }

    const resultResponse = await waitForMessage(parser, MSG_TYPES.RESULT);
    
    return resultResponse.success && resultResponse.data.device === 'Arduino HID';
  } catch (error) {
    logger.debug('Port verification failed:', error);
    return false;
  }
}

async function findArduinoPort(): Promise<SerialPort | null> {
  try {
    const ports = await SerialPort.list();

    for (const portInfo of ports) {
      logger.info(`Trying port ${portInfo.path}...`);
      
      try {
        const port = new SerialPort({
          path: portInfo.path,
          baudRate: 115200
        });

        // Wait for port to open
        await new Promise<void>((resolve, reject) => {
          port.on('open', resolve);
          port.on('error', reject);
        });

        // Verify if this is our Arduino
        const isArduino = await verifyArduinoPort(port);
        
        if (isArduino) {
          logger.info(`Arduino HID found on port ${portInfo.path}`);
          return port; // Return the open port instead of closing it
        }
        
        port.close(); // Only close if it's not our Arduino
      } catch (error) {
        logger.debug(`Failed to verify port ${portInfo.path}`);
        continue;
      }
    }
    
    logger.warn('No Arduino HID device found');
    return null;
  } catch (error) {
    logger.error('Error finding Arduino port:', error);
    return null;
  }
}

async function initializeArduino(): Promise<SerialPort> {
  try {
    if (config.ARDUINO_PORT) {
      // If port is configured, create new connection
      arduinoPort = new SerialPort({
        path: config.ARDUINO_PORT,
        baudRate: 115200
      });

      const isArduino = await verifyArduinoPort(arduinoPort);
      if (!isArduino) {
        arduinoPort.close();
        throw new Error('Specified port is not an Arduino HID device');
      }
    } else {
      // Use the already verified and open port from findArduinoPort
      arduinoPort = await findArduinoPort();
      if (!arduinoPort) {
        throw new Error('Arduino port not found');
      }
    }

    logger.info(`Arduino initialized on port: ${arduinoPort.path}`);

    arduinoPort.on('error', (err: Error) => {
      logger.error('Arduino connection error:', err);
    });

    return arduinoPort;
  } catch (error) {
    logger.error('Failed to initialize Arduino:', error);
    throw error;
  }
}

function getArduinoPort(): SerialPort | null {
  return arduinoPort;
}

export {
  initializeArduino,
  getArduinoPort,
  waitForMessage,
  MSG_TYPES
}; 