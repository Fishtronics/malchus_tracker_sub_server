export default {
  PORT: process.env.PORT || 3000,
  ARDUINO_PORT: process.env.ARDUINO_PORT || null,
  RETRY_ATTEMPTS: parseInt(process.env.RETRY_ATTEMPTS || '2'),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
}; 