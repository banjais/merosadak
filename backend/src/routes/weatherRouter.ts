// backend/src/routes/weatherRouter.ts
import { Router } from 'express';
import { getCurrentWeather } from '../controllers/weatherController.js';

const router = Router();

router.get('/', getCurrentWeather);

export default router;
