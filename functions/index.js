/**
 * API Proxy Cloud Function
 * Proxies requests from Firebase Hosting to Render backend
 */
const functions = require('firebase-functions');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Render backend URL
const TARGET = 'https://sadaksathi.onrender.com';

// Create proxy middleware
const apiProxy = createProxyMiddleware({
  target: TARGET,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api/v1', // Map /api to /api/v1 on backend
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(502).json({ error: 'Proxy error', message: err.message });
  },
});

// Handle all API requests
exports.apiProxy = functions.https.onRequest((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  return apiProxy(req, res);
});