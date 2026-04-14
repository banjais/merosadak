# MeroSadak - Render Deployment & Monitoring Guide

## Overview
This guide covers the deployment configuration for Render and the UptimeRobot monitoring integration for keeping the free tier service always active.

---

## 🚀 Render Deployment

### Configuration (`render.yaml`)

The `render.yaml` file configures the Render deployment with the following settings:

- **Service Type**: Web service (Node.js 20)
- **Region**: Oregon (closest to Nepal with good performance)
- **Auto-deploy**: Enabled (deploys on push to `main` branch)
- **Health Check**: `/health/live` endpoint
- **Persistent Disk**: 1GB for caching road data and analytics

### Environment Variables

The following environment variables are configured:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Node environment |
| `RATE_LIMIT_MAX` | `100` | API rate limiting |
| `PORT` | Auto-set by Render | Service port |
| `RENDER_EXTERNAL_URL` | Auto-set by Render | Service URL |

### Deployment Steps

1. **Connect Repository**: Link your GitHub repository to Render
2. **Deploy**: Render will automatically use `render.yaml` configuration
3. **Monitor**: Check deployment status at `https://dashboard.render.com`

### Health Check Endpoints

- **Basic Health**: `GET /health`
- **Liveness Probe**: `GET /health/live`
- **Readiness Probe**: `GET /health/ready`

These endpoints are used by Render to ensure the service is running properly.

---

## 📊 UptimeRobot Monitoring

### Public Status Page

**URL**: https://uptimerobot.com/ZaSzISaXMt

The public status page provides real-time monitoring statistics and uptime history.

### Integration

#### Backend API

The UptimeRobot service (`backend/src/services/uptimeRobotService.ts`) provides:

- **Real-time monitoring stats** via `/api/v1/monitoring/status`
- **Uptime percentage** via `/api/v1/monitoring/uptime`
- **Public status page link** via `/api/v1/monitoring/public-status`

#### Frontend Component

The `UptimeRobotStats` component displays:

- Overall system status (Operational/Degraded/Down)
- Uptime percentage (last 7/30/90 days)
- Response time monitoring
- SSL certificate expiry warnings
- Link to public status page

### Accessing Monitoring Stats

#### From the Dashboard

1. Click the **System Menu** (gear icon)
2. Click **Monitoring Status** (with "Live" badge)
3. View real-time monitoring stats

#### From the API

```bash
# Get full monitoring status
curl https://your-render-url.onrender.com/api/v1/monitoring/status

# Get uptime only
curl https://your-render-url.onrender.com/api/v1/monitoring/uptime

# Get public status page URL
curl https://your-render-url.onrender.com/api/v1/monitoring/public-status
```

### Optional: UptimeRobot API Key

For detailed monitoring stats, you can add your UptimeRobot API key:

1. Get your API key from: https://uptimerobot.com/dashboard -> My Settings -> API Settings
2. Add it to Render environment variables as `UPTIMEROBOT_API_KEY`

**Without the API key**, the service will show basic mock stats and link to the public status page.

---

## 🔧 Preventing Render Free Tier Sleep

Render free tier services sleep after 15 minutes of inactivity. To prevent this:

### Built-in Self-Ping

The backend includes an automatic self-ping mechanism:

- **Interval**: Every 10 minutes
- **Endpoint**: `/health/live`
- **Purpose**: Keeps the service awake

This is enabled automatically in production mode (`NODE_ENV=production`).

### UptimeRobot Monitor (Recommended)

Set up a monitor on UptimeRobot:

1. Create a new monitor at https://uptimerobot.com
2. Set the URL to: `https://your-render-url.onrender.com/health/live`
3. Set monitoring interval to **5 minutes**
4. This will ping your service every 5 minutes, preventing sleep

**Public status page**: https://uptimerobot.com/ZaSzISaXMt

---

## 📝 Changes Made

### Files Modified

1. **`package.json`**: Removed SnapDeploy references, added Render scripts
2. **`render.yaml`**: Enhanced with health checks, disk, and auto-deploy config
3. **`backend/src/routes/routerIndex.ts`**: Added uptime monitoring router
4. **`frontend/src/App.tsx`**: Integrated UptimeRobot stats component
5. **`frontend/src/components/SystemMenu.tsx`**: Added monitoring status button

### Files Created

1. **`backend/src/services/uptimeRobotService.ts`**: UptimeRobot API integration
2. **`backend/src/routes/uptimeRouter.ts`**: API endpoints for monitoring stats
3. **`frontend/src/components/UptimeRobotStats.tsx`**: Monitoring dashboard UI

---

## 🎯 Next Steps

1. **Deploy to Render**: Connect your GitHub repo and deploy
2. **Setup UptimeRobot Monitor**: Add your Render URL to UptimeRobot
3. **Add API Key** (optional): For detailed stats in the dashboard
4. **Monitor**: Check https://uptimerobot.com/ZaSzISaXMt for uptime stats

---

## 📞 Support

- **Render Dashboard**: https://dashboard.render.com
- **UptimeRobot Dashboard**: https://uptimerobot.com/dashboard
- **Public Status**: https://uptimerobot.com/ZaSzISaXMt
