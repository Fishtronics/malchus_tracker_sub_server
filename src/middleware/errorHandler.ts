import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  logger.error('Error:', err);

  res.status(500).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}

export default errorHandler; 