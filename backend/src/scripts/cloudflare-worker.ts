/**
 * Cloudflare Worker - API Proxy + Offline fallback data
 */
const HIGHWAYS_DATA = [
  { code: "NH01", name: "Mahendra Highway", route: "Kakarbhitta - Mahendranagar", districts: ["Jhapa", "Morang", "Sunsari", "Chitwan", "Makwanpur", "Nawalparasi", "Rupandehi", "Dang", "Banke", "Bardiya", "Kailali", "Kanchanpur"] },
  { code: "NH02", name: "Kechana Chandragadhi Charali Ilam Highway", route: "Kechana - Chandragadhi - Charali - Ilam", districts: ["Jhapa", "Ilam"] },
  { code: "NH03", name: "Pushpalal Mid Hill Highway", route: "Khotang - Bhojpur - Dhankuta - Terhathum - Panchthar - Ilam", districts: ["Khotang", "Bhojpur", "Dhankuta", "Terhathum", "Panchthar", "Ilam"] },
  { code: "NH04", name: "Birtamod Chandragadi Bhadrapur Highway", route: "Birtamod - Chandragadhi - Bhadrapur", districts: ["Jhapa"] },
  { code: "NH05", name: "Postal Highway", route: "East-West corridor through Terai", districts: ["Jhapa", "Morang", "Sunsari", "Chitwan", "Nawalparasi", "Rupandehi", "Dang", "Banke", "Bardiya", "Kailali", "Kanchanpur"] },
  { code: "NH17", name: "Prithvi Highway", route: "Naubise - Mugling - Dumre", districts: ["Dhading", "Chitwan", "Tanahu"] },
  { code: "NH18", name: "Balaju Trishuli Dhur Highway", route: "Balaju - Trishuli - Dhur", districts: ["Kathmandu", "Nuwakot", "Rasuwa"] },
];

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

    // Try Render backend
    try {
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
      // Render down - serve offline data
      if (url.pathname === "/api/highways" || url.pathname === "/api/highways/") {
        const limit = parseInt(url.searchParams.get("limit") || "79", 10);
        return new Response(JSON.stringify({
          success: true,
          message: "Offline mode - showing cached data",
          count: HIGHWAYS_DATA.length,
          data: HIGHWAYS_DATA.slice(0, limit)
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (url.pathname.startsWith("/api/highways/") && url.pathname.includes("/linked")) {
        const code = url.pathname.split("/")[3]?.toUpperCase();
        const highway = HIGHWAYS_DATA.find(h => h.code === code);
        if (highway) {
          return new Response(JSON.stringify({
            success: true,
            message: "Offline mode",
            data: {
              highway: { code: highway.code, name: highway.name },
              route: { districts: highway.districts, provinces: ["Province 1", "Province 3", "Province 5", "Province 7"] },
              segments: { total: 482, totalLengthKm: 1127.5 },
              incidents: { totalActive: 0 }
            }
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      if (url.pathname === "/api/search") {
        return new Response(JSON.stringify({
          success: true,
          message: "Offline mode",
          query: url.searchParams.get("q") || "",
          count: HIGHWAYS_DATA.length,
          data: HIGHWAYS_DATA.slice(0, 5).map(h => ({
            id: h.code, name: h.name, type: "road", lat: 27.7, lng: 85.3, source: "offline"
          }))
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ 
        error: "Backend offline", 
        message: "Render not responding. Try again later."
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  },
};

// Cron: keep Render awake
export const scheduled = async () => {
  try {
    await fetch("https://merosadak.onrender.com/api/health", { signal: AbortSignal.timeout(10000) });
  } catch {}
};