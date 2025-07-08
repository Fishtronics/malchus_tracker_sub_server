import { Router } from 'express';
import { verifyCredentials } from '../controllers/cloudServerController';
import { validateHomeServerCredentials } from '../middleware/authMiddleware';

const router = Router();

// Public route - used for initial verification
router.post('/verify', verifyCredentials);

// Protected routes - require valid credentials
// router.post('/startLogin', validateHomeServerCredentials, startLogin);
// router.post('/enterEmail', validateHomeServerCredentials, enterEmail);
// router.post('/enterPassword', validateHomeServerCredentials, enterPassword);

export default router;
