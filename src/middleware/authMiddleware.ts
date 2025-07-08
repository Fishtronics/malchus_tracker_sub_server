import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface AuthenticatedRequest extends Request {
  homeServer?: {
    name: string;
    password: string;
  };
}

export function validateHomeServerCredentials(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { serverName, serverPassword } = req.body;

    // Get credentials from environment variables
    const validName = process.env.HOME_SERVER_NAME;
    const validPassword = process.env.HOME_SERVER_PASSWORD;

    if (!validName || !validPassword) {
      logger.error('Home server credentials not configured');
      return res.status(500).json({ 
        success: false, 
        error: 'Server not configured' 
      });
    }

    if (!serverName || !serverPassword) {
      logger.warn('Missing credentials in request');
      return res.status(401).json({ 
        success: false, 
        error: 'Server name and password are required' 
      });
    }

    if (serverName !== validName || serverPassword !== validPassword) {
      logger.warn('Invalid credentials provided');
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    // Add credentials to request for use in route handlers
    req.homeServer = {
      name: serverName,
      password: serverPassword
    };

    next();
  } catch (error) {
    logger.error('Error in auth middleware:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
} 