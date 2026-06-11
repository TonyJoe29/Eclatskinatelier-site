const API_HOST = "https://us.i.posthog.com";
const ASSET_HOST = "https://us-assets.i.posthog.com";
const GOOGLE_TAG_HOST = "https://www.googletagmanager.com";
const GOOGLE_ANALYTICS_HOST = "https://www.google-analytics.com";

export function routePostHogRequest(url) {
  const assetRequest =
    url.pathname.startsWith("/static/") || url.pathname.startsWith("/array/");
  return new URL(`${url.pathname}${url.search}`, assetRequest ? ASSET_HOST : API_HOST);
}

export function routeAnalyticsRequest(url) {
  if (!url.pathname.startsWith("/ga/")) return null;

  const pathname = url.pathname.slice(3) || "/";
  const host = pathname.startsWith("/gtag/")
    ? GOOGLE_TAG_HOST
    : GOOGLE_ANALYTICS_HOST;
  return new URL(`${pathname}${url.search}`, host);
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
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
