const API_HOST = "https://us.i.posthog.com";
const ASSET_HOST = "https://us-assets.i.posthog.com";
const GOOGLE_TAG_HOST = "https://www.googletagmanager.com";
const GOOGLE_ANALYTICS_HOST = "https://www.google-analytics.com";
const GA4_MEASUREMENT_ID = "G-PEVS2KHDT5";
const GA4_EVENT_NAMES = new Set(["affiliate_click"]);
const GA4_PARAMETER_NAMES = new Set([
  "affiliate_network",
  "amazon_tracking_id",
  "asin",
  "debug_mode",
  "engagement_time_msec",
  "link_position",
  "link_url",
  "page_location",
  "page_path",
  "product_name",
  "qa_test",
  "session_id",
  "transport_type",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
]);
const ALLOWED_ORIGINS = new Set([
  "https://eclatskinatelier-site.onrender.com",
  "http://127.0.0.1:8765",
  "http://localhost:8765",
]);

export function routePostHogRequest(url) {
  const assetRequest =
    url.pathname.startsWith("/static/") || url.pathname.startsWith("/array/");
  return new URL(`${url.pathname}${url.search}`, assetRequest ? ASSET_HOST : API_HOST);
}

export function routeAnalyticsRequest(url) {
  if (!url.pathname.startsWith("/metrics/")) return null;

  const pathname =
    url.pathname === "/metrics/client.js"
      ? "/gtag/js"
      : url.pathname.slice("/metrics".length) || "/";
  const host = pathname === "/gtag/js"
    ? GOOGLE_TAG_HOST
    : GOOGLE_ANALYTICS_HOST;
  return new URL(`${pathname}${url.search}`, host);
}

export function buildGa4MeasurementPayload(input) {
  if (
    !input ||
    typeof input.client_id !== "string" ||
    !input.client_id.trim() ||
    !GA4_EVENT_NAMES.has(input.event_name)
  ) {
    return null;
  }

  const params = {};
  for (const [key, value] of Object.entries(input.params || {})) {
    if (!GA4_PARAMETER_NAMES.has(key)) continue;
    if (!["string", "number", "boolean"].includes(typeof value)) continue;
    params[key] = typeof value === "string" ? value.slice(0, 500) : value;
  }

  return {
    client_id: input.client_id.trim().slice(0, 128),
    events: [{ name: input.event_name, params }],
  };
}

function proxyHeaders(request, target) {
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("host");
  headers.delete("accept-encoding");
  headers.set("host", target.hostname);

  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) headers.set("X-Forwarded-For", ip);
  return headers;
}

async function forward(request, target) {
  const response = await fetch(target, {
    method: request.method,
    headers: proxyHeaders(request, target),
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
    redirect: "follow",
  });

  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function corsHeaders(origin) {
  const headers = new Headers();
  if (ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return headers;
}

async function captureGa4Event(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (!ALLOWED_ORIGINS.has(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!env.GA4_API_SECRET) {
    return new Response("Analytics unavailable", { status: 503 });
  }

  let input;
  try {
    input = JSON.parse(await request.text());
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const payload = buildGa4MeasurementPayload(input);
  if (!payload) return new Response("Invalid event", { status: 400 });

  const target = new URL("/mp/collect", GOOGLE_ANALYTICS_HOST);
  target.searchParams.set("measurement_id", GA4_MEASUREMENT_ID);
  target.searchParams.set("api_secret", env.GA4_API_SECRET);

  const response = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    return new Response("Analytics upstream error", { status: 502 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/metrics/event") {
      return captureGa4Event(request, env);
    }
    const analyticsTarget = routeAnalyticsRequest(url);
    const target = analyticsTarget || routePostHogRequest(url);
    const isAsset =
      (target.origin === ASSET_HOST || target.origin === GOOGLE_TAG_HOST) &&
      request.method === "GET";

    if (!isAsset) return forward(request, target);

    const cache = caches.default;
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await forward(request, target);
    if (response.ok) ctx.waitUntil(cache.put(request, response.clone()));
    return response;
  },
};
