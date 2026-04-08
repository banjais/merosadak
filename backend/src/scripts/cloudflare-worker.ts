/**
 * Cloudflare Worker - API Proxy + Auto-wake Render
 */
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Try Render backend with auto-wake
    try {
      // Ping Render to wake it up (first request may wake it)
      fetch("https://merosadak.onrender.com/api/highways?limit=1", { 
        method: "HEAD", 
        signal: AbortSignal.timeout(5000) 
      }).catch(() => {});
      
      const renderUrl = `https://merosadak.onrender.com${url.pathname}${url.search}`;
      const response = await fetch(renderUrl, {
        method: request.method,
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      // Render sleeping - return offline message
      if (url.pathname === "/api/highways" || url.pathname.startsWith("/api/")) {
        return new Response(JSON.stringify({
          success: true,
          message: "Backend waking up...",
          data: []
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ 
        error: "Backend waking up", 
        message: "Please retry in a few seconds"
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  },
};

/**
 * Cron trigger - keeps Render awake
 */
export const scheduled = async (event: ScheduledEvent) => {
  try {
    // Ping Render every 5 minutes to keep it awake
    await fetch("https://merosadak.onrender.com/api/health", { 
      method: "GET",
      signal: AbortSignal.timeout(10000)
    });
    console.log("Render kept awake");
  } catch (e) {
    console.log("Render ping failed (sleeping)");
  }
};