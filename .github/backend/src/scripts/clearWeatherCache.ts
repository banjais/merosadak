import { getRedisClient } from '../services/cacheService.js';

try {
  const redis = getRedisClient();
  await redis.del('weather:27.72:85.32');
  console.log('Cleared weather:27.72:85.32 from Redis');

  const val = await redis.get('weather:27.72:85.32');
  console.log('Verify (should be null):', val);
} catch (e: any) {
  console.error('Error:', e.message);
}

process.exit(0);
