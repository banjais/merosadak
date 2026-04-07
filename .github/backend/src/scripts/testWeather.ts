import * as weatherService from '../services/weatherService.js';

const result = await weatherService.getWeather();
console.log('Result:', JSON.stringify(result, null, 2));
process.exit(0);
