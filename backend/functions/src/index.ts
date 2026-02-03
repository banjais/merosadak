// backend/functions/src/index.ts
import * as functions from 'firebase-functions';
import axios from 'axios';

/**
 * 🛰️ Firebase API Proxy
 * Redirects all /api requests from sadaksathi.web.app/api to sadaksathi.onrender.com
 * This solves the "cold start" and keeps the primary backend on Render.
 */
export const apiProxy = functions.https.onRequest(async (req, res) => {
  // 1. Determine Target URL
  const RENDER_URL = 'https://sadaksathi-all-in-one.onrender.com'; // Adjust to your actual Render URL
  const targetUrl = `${RENDER_URL}${req.originalUrl}`;

  try {
    // 2. Clear out host headers to avoid SSL mismatches
    const headers = { ...req.headers };
    delete headers.host;
    delete headers['x-forwarded-for'];

    // 3. Forward the request with a timeout
    const response = await axios({
      method: req.method as any,
      url: targetUrl,
      data: req.body,
      headers,
      params: req.query,
      timeout: 55000, // 55s (to stay under Firebase 60s limit)
      validateStatus: () => true, // Forward all status codes
    });

    // 4. Return the response to frontend
    res.status(response.status).json(response.data);
  } catch (err: any) {
    const isTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout');
    console.error(`[Proxy Error] ${req.method} ${targetUrl}:`, err.message);
    
    res.status(isTimeout ? 504 : 502).json({ 
      success: false, 
      error: isTimeout ? 'Backend gateway timeout' : 'Backend unreachable',
      details: err.message
    });
  }
});