import { Router } from 'express';
import { addBrowserProfile, deleteProfile } from '../controllers/browserController';
import { validateHomeServerCredentials } from '../middleware/authMiddleware';

const router = Router();

router.post('/add-browser-profile', validateHomeServerCredentials, addBrowserProfile);
router.post('/delete-profile', validateHomeServerCredentials, deleteProfile);

export default router; 