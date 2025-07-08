import { Request, Response } from 'express';
import logger from '../utils/logger';
import { connectToCloudServer } from '../services/websocketService';

export async function verifyCredentials(req: Request, res: Response) {
  try {
    const { serverName, serverPassword } = req.body;
    logger.info('Received verification request:', { serverName, serverPassword });
    
    // Get credentials from environment variables
    const validName = process.env.HOME_SERVER_NAME;
    const validPassword = process.env.HOME_SERVER_PASSWORD;

    if (!validName || !validPassword) {
      logger.error('Home server credentials not configured');
      return res.status(500).json({
        success: false,
        message: 'Server not configured'
      });
    }

    if (serverName === validName && serverPassword === validPassword) {
      logger.info('Verification successful');
      connectToCloudServer({
        cloudServerUrl: process.env.CLOUD_SERVER_URL!,
        name: serverName,
        password: serverPassword
      });
      return res.status(200).json({
        success: true,
        message: 'Credentials verified successfully'
      });
    }

    logger.warn('Invalid credentials provided');
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });

  } catch (error) {
    logger.error('Error verifying credentials:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
} 
