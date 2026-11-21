/**
 * LIVE LOG - LiveFans event page fetcher
 *
 * Deploy as a Cloudflare Worker. This endpoint fetches only a numeric
 * LiveFans event ID; it is deliberately not a general-purpose URL proxy.
 */
const ALLOWED_ORIGINS = new Set([
  "https://yuta0626.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);

function corsHeaders(origin) {
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Expose-Headers": "X-LiveFans-Upstream-Status, X-LiveFans-URL"
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return new Response("Origin not allowed", { status: 403, headers: cors });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: cors });
    }
    if (url.pathname !== "/event") {
      return new Response("Not found. Use /event?id=LIVEFANS_EVENT_ID", {
        status: 404, headers: cors
      });
    }

    const id = url.searchParams.get("id") || "";
    if (!/^\d{1,12}$/.test(id)) {
      return new Response("Invalid LiveFans event ID", { status: 400, headers: cors });
    }

    const upstreamUrl = `https://www.livefans.jp/events/${id}`;
    try {
      const upstream = await fetch(upstreamUrl, {
        method: "GET",
        redirect: "follow",
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
          "Cache-Control": "no-cache"
        },
        signal: AbortSignal.timeout(20000)
      });

      const body = await upstream.text();
      const headers = new Headers(cors);
      headers.set("Content-Type", upstream.headers.get("Content-Type") || "text/html; charset=utf-8");
      headers.set("Cache-Control", "public, max-age=60, s-maxage=180");
      headers.set("X-LiveFans-Upstream-Status", String(upstream.status));
      headers.set("X-LiveFans-URL", upstreamUrl);

      if (!upstream.ok) {
        return new Response(body || `LiveFans returned HTTP ${upstream.status}`, {
          status: 502, headers
        });
      }
      if (body.length < 1000 || !/livefans|セットリスト|公演情報/i.test(body)) {
        return new Response("LiveFans response was empty or not an event page", {
          status: 502, headers
        });
      }
      return new Response(body, { status: 200, headers });
    } catch (error) {
      return new Response(`LiveFans fetch failed: ${error?.message || String(error)}`, {
        status: 502,
        headers: { ...Object.fromEntries(cors), "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  }
};
