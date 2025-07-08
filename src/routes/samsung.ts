import { Router } from 'express';
import { startLogin, enterEmail, enterPassword, getDevices, getDeviceDetails, changePassword, setDeviceNotifyEmail } from '../controllers/samsungController';
import { validateHomeServerCredentials } from '../middleware/authMiddleware';

const router = Router();

router.post('/start-login', validateHomeServerCredentials, startLogin);
router.post('/enter-email', validateHomeServerCredentials, enterEmail);
router.post('/enter-password', validateHomeServerCredentials, enterPassword);
router.post('/get-devices', validateHomeServerCredentials, getDevices);
router.post('/get-device-details', validateHomeServerCredentials, getDeviceDetails);
router.post('/set-device-notify-email', validateHomeServerCredentials, setDeviceNotifyEmail);
router.post('/change-password', validateHomeServerCredentials, changePassword);

export default router; 