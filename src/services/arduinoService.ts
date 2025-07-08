import logger from '../utils/logger';
import { getArduinoPort, waitForMessage } from '../utils/usart';
import { Credentials, LocationData, MSG_TYPES, ArduinoMessage, ArduinoCommand } from '../types';
import { ReadlineParser } from '@serialport/parser-readline';
import clipboardy from 'clipboardy';
import { Command } from '../types/arduino';

let arduinoBusy = false;

export function setArduinoBusy(busy: boolean) {
  arduinoBusy = busy;
}

export function getArduinoBusy(): boolean {
  return arduinoBusy;
}

async function sendCommandAndWaitForResult(command: ArduinoCommand): Promise<ArduinoMessage> {
  const arduinoPort = getArduinoPort();

  if (!arduinoPort) {
    throw new Error('Arduino not connected');
  }

  const parser = arduinoPort.pipe(new ReadlineParser({ delimiter: '\n' }));

  try {
    // Send command
    logger.info(`Sending ${command.command} command to Arduino`);
    arduinoPort.write(JSON.stringify(command) + '\n');

    // Wait for acknowledgment
    const ack = await waitForMessage(parser, MSG_TYPES.ACK);
    if (!ack.success) {
      throw new Error('Failed to get acknowledgment: ' + ack.message);
    }
    logger.info('Arduino acknowledged command');

    // Wait for and log status messages
    let statusMsg;
    do {
      statusMsg = await waitForMessage(parser);
      if (statusMsg.type === MSG_TYPES.STATUS) {
        logger.info('Status update:', statusMsg.message);
      } else if (statusMsg.type === MSG_TYPES.ERROR) {
        throw new Error(`Error during ${command.command}: ` + statusMsg.message);
      } else if (statusMsg.type === MSG_TYPES.RESULT) {
        break;
      }
    } while (statusMsg.type === MSG_TYPES.STATUS);

    // Verify final result
    if (statusMsg.type === MSG_TYPES.RESULT && statusMsg.success) {
      logger.info(`${command.command} completed successfully`);
      return statusMsg;
    } else {
      throw new Error(`${command.command} failed: ` + statusMsg.message);
    }

  } catch (error: any) {
    logger.error('Error in Arduino communication:', error);
    return {
      success: false,
      message: error.message,
      type: MSG_TYPES.ERROR
    };
  }
}

// async function checkLoginStatus(): Promise<boolean> {
//   const result = await sendCommandAndWaitForResult({
//     command: 'checkStatus'
//   });

//   try {
//     const clipboardContent = await clipboardy.read();
//     // If URL contains 'signInGate' or 'login', user is not logged in
//     const isLoggedIn = !clipboardContent.includes('signInGate') && !clipboardContent.includes('login');

//     logger.info(`Login status checked: ${isLoggedIn ? 'Logged in' : 'Not logged in'}`);
//     return isLoggedIn;
//   } catch (error) {
//     logger.error('Error checking login status:', error);
//     throw new Error('Failed to check login status');
//   }
// }

// async function login(credentials: Credentials): Promise<void> {
//   await sendCommandAndWaitForResult({
//     command: 'login',
//     credentials
//   });

//   // Verify login was successful
//   const isLoggedIn = await checkLoginStatus();
//   if (!isLoggedIn) {
//     throw new Error('Login verification failed');
//   }
// }

// async function logout(): Promise<void> {
//   await sendCommandAndWaitForResult({
//     command: 'logout'
//   });

//   // Verify logout was successful
//   const isLoggedIn = await checkLoginStatus();
//   if (isLoggedIn) {
//     throw new Error('Logout verification failed');
//   }
// }

// async function getLocationData(): Promise<LocationData> {
//   const result = await sendCommandAndWaitForResult({
//     command: 'getLocationData'
//   });

//   try {
//     const locationClipboard = await clipboardy.read();
//     const locationData = {
//       latitude: parseFloat(locationClipboard.split(',')[0]),
//       longitude: parseFloat(locationClipboard.split(',')[1]),
//       altitude: parseFloat(locationClipboard.split(',')[2])
//     };
//     return locationData;
//   } catch (error) {
//     logger.error('Error parsing location data:', error);
//     throw new Error('Failed to parse location data from clipboard');
//   }
// }

async function moveMouse(x: number, y: number): Promise<ArduinoMessage> {
  const mouseSetting = {
    resolutionWidth: process.env.HOME_SERVER_SCREEN_WIDTH || '1920',
    resolutionHeight: process.env.HOME_SERVER_SCREEN_HEIGHT || '1080',
    correctionFactor: process.env.MOUSE_CORRECTION_FACTOR || '1'
  }
  const result = await sendCommandAndWaitForResult({
    command: Command.CMD_MOUSE_MOVE,
    x,
    y,
    mouseSetting
  });
  return result;
}

async function clickMouse(): Promise<ArduinoMessage> {
  const result = await sendCommandAndWaitForResult({
    command: Command.CMD_MOUSE_CLICK
  });
  return result;
}

async function scrollMouse(amount: number): Promise<ArduinoMessage> {
  const result = await sendCommandAndWaitForResult({
    command: Command.CMD_MOUSE_SCROLL,
    scrollAmount: amount
  });
  return result;
}

async function typeText(text: string): Promise<ArduinoMessage> {
  const result = await sendCommandAndWaitForResult({
    command: Command.CMD_TYPING,
    text
  });
  return result;
}

async function copyText(): Promise<ArduinoMessage> {
  const result = await sendCommandAndWaitForResult({
    command: Command.CMD_COPY
  });
  return result;
}

async function enter(): Promise<ArduinoMessage> {
  const result = await sendCommandAndWaitForResult({
    command: Command.CMD_ENTER
  });
  return result;
}

async function selectAll(): Promise<ArduinoMessage> {
  const result = await sendCommandAndWaitForResult({
    command: Command.CMD_SELECT_ALL
  });
  return result;
}

async function deleteText(): Promise<ArduinoMessage> {
  const result = await sendCommandAndWaitForResult({
    command: Command.CMD_DELETE
  });
  return result;
}

async function backspace(): Promise<ArduinoMessage> {
  const result = await sendCommandAndWaitForResult({
    command: Command.CMD_BACKSPACE
  });
  return result;
}

async function tab(): Promise<ArduinoMessage> {
  const result = await sendCommandAndWaitForResult({
    command: Command.CMD_TAB
  });
  return result;
}

export {
  moveMouse,
  clickMouse,
  scrollMouse,
  typeText,
  copyText,
  enter,
  selectAll,
  deleteText,
  backspace,
  tab
}; 