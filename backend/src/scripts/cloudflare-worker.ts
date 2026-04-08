/**
 * Cloudflare Worker - API Proxy + Static fallback
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

    // Try Render backend first
    try {
      const renderUrl = `https://merosadak.onrender.com${url.pathname}${url.search}`;
      const response = await fetch(renderUrl, {
        method: request.method,
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      // Render not available - return offline message with sample data
      if (url.pathname === "/api/highways") {
        return new Response(JSON.stringify({
          success: true,
          message: "Backend offline - showing cached demo data",
          count: 2,
          data: [
            { code: "NH01", name: "Mahendra Highway", route: "Kakarbhitta - Mahendranagar" },
            { code: "NH02", name: "Pushpalal Highway", route: "East-West corridor" }
          ]
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ 
        error: "Backend offline", 
        message: "Render server not responding. Please try again later."
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  },
};