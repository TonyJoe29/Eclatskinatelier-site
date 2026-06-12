const UTM_PARAMETERS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];
const GA4_EVENT_ENDPOINT =
  "https://eclat-events.eclatskinatelier.workers.dev/metrics/event";

function isAmazonUrl(url) {
  return /(^|\.)amazon\.com$|(^|\.)amzn\.to$/i.test(url.hostname);
}

function inferProductName(link) {
  const explicit = link.dataset.productName?.trim();
  if (explicit) return explicit;

  const container = link.closest("article, section, li, .card, .product, .product-card, .drop-card");
  const heading = container?.querySelector("h1, h2, h3, h4, strong");
  const headingText = heading?.textContent?.trim();
  if (headingText) return headingText;

  return link.textContent
    ?.replace(/\s+/g, " ")
    .replace(/\b(shop|buy|view|on amazon|amazon)\b/gi, "")
    .trim() || "Unknown product";
}

function inferAsin(link, url) {
  const explicit = link.dataset.asin?.trim();
  if (explicit) return explicit.toUpperCase();

  const pathMatch = url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return pathMatch?.[1]?.toUpperCase() || "";
}

function inferLinkPosition(link) {
  const explicit = link.dataset.linkPosition?.trim();
  if (explicit) return explicit;

  const section = link.closest("[id]");
  const sectionName = section?.id || "page";
  const amazonLinks = [...document.querySelectorAll("a[href]")].filter((candidate) => {
    try {
      return isAmazonUrl(new URL(candidate.href, window.location.href));
    } catch {
      return false;
    }
  });
  return `${sectionName}-${Math.max(amazonLinks.indexOf(link) + 1, 1)}`;
}

function inferTrackingId(link, url) {
  return link.dataset.amazonTrackingId?.trim() || url.searchParams.get("tag") || "";
}

function campaignProperties() {
  const search = new URLSearchParams(window.location.search);
  return Object.fromEntries(
    UTM_PARAMETERS.map((parameter) => [parameter, search.get(parameter) || ""]),
  );
}

function isQaTest() {
  const hostname = window.location.hostname;
  const requested = new URLSearchParams(window.location.search).get("qa_test");
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    requested === "1" ||
    requested === "true"
  );
}

function sessionValue(key, createValue) {
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const value = createValue();
    window.sessionStorage.setItem(key, value);
    return value;
  } catch {
    return createValue();
  }
}

function ga4ClientId() {
  return sessionValue(
    "eclat_ga4_client_id",
    () => `${Date.now()}.${Math.floor(Math.random() * 1_000_000_000)}`,
  );
}

function ga4SessionId() {
  return Number(sessionValue("eclat_ga4_session_id", () => String(Date.now())));
}

function sendGa4Event(eventName, properties) {
  const payload = JSON.stringify({
    client_id: ga4ClientId(),
    event_name: eventName,
    params: {
      ...properties,
      session_id: ga4SessionId(),
      engagement_time_msec: 1,
      debug_mode: isQaTest(),
      page_location: window.location.href,
    },
  });

  if (typeof navigator.sendBeacon === "function") {
    const body = new Blob([payload], { type: "text/plain;charset=UTF-8" });
    if (navigator.sendBeacon(GA4_EVENT_ENDPOINT, body)) return;
  }

  fetch(GA4_EVENT_ENDPOINT, {
    method: "POST",
    body: payload,
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    keepalive: true,
  }).catch(() => {});
}

function trackAffiliateClick(link) {
  let url;
  try {
    url = new URL(link.href, window.location.href);
  } catch {
    return;
  }
  if (!isAmazonUrl(url)) return;

  const properties = {
    product_name: inferProductName(link),
    asin: inferAsin(link, url),
    page_path: window.location.pathname,
    link_url: url.href,
    link_position: inferLinkPosition(link),
    affiliate_network: link.dataset.affiliateNetwork || "amazon",
    amazon_tracking_id: inferTrackingId(link, url),
    qa_test: isQaTest(),
    ...campaignProperties(),
    transport_type: "beacon",
  };

  sendGa4Event("affiliate_click", properties);
  if (typeof window.posthog?.capture === "function") {
    window.posthog.capture("affiliate_click", properties);
  }
}

function preserveCampaignParameters() {
  const currentUrl = new URL(window.location.href);
  const campaign = new URLSearchParams();

  for (const parameter of UTM_PARAMETERS) {
    const value = currentUrl.searchParams.get(parameter);
    if (value) campaign.set(parameter, value);
  }
  if (!campaign.size) return;

  for (const link of document.querySelectorAll("a[href]")) {
    const rawHref = link.getAttribute("href");
    if (!rawHref || rawHref.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(rawHref)) continue;

    let target;
    try {
      target = new URL(rawHref, window.location.href);
    } catch {
      continue;
    }
    if (target.origin !== window.location.origin) continue;

    for (const [parameter, value] of campaign) {
      if (!target.searchParams.has(parameter)) target.searchParams.set(parameter, value);
    }
    link.href = target.href;
  }
}

preserveCampaignParameters();

document.addEventListener("click", (event) => {
  const link = event.target.closest?.("a[href]");
  if (link) trackAffiliateClick(link);
});
