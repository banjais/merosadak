import { Router } from 'express';
import { getTraffic, getTrafficTile } from '../controllers/trafficController.js';

const router = Router();

// 🌐 JSON traffic data
router.get('/status', getTraffic);

// 🖼️ Traffic overlay tiles
router.get('/tile/:z/:x/:y', getTrafficTile);

export default router;
