const UTM_PARAMETERS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

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
    ...campaignProperties(),
    transport_type: "beacon",
  };

  if (typeof window.gtag === "function") {
    window.gtag("event", "affiliate_click", properties);
  }
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
